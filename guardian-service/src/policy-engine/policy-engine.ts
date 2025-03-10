import { AccessType, AssignedEntityType, EntityStatus, GenerateUUIDv4, IOwner, IRootConfig, ModelHelper, NotificationAction, PolicyEvents, PolicyToolMetadata, PolicyType, Schema, SchemaEntity, SchemaHelper, SchemaStatus, TagType, TopicType } from '@guardian/interfaces';
import {
    Artifact,
    DatabaseServer,
    findAllEntities,
    FormulaImportExport,
    getArtifactType,
    IPolicyComponents,
    MessageAction,
    MessageServer,
    MessageType,
    MultiPolicy,
    NatsService,
    NotificationHelper, PinoLogger,
    Policy,
    PolicyImportExport,
    PolicyMessage,
    replaceAllEntities,
    replaceAllVariables,
    replaceArtifactProperties, Schema as SchemaCollection,
    SchemaFields,
    Singleton,
    SynchronizationMessage,
    TagMessage,
    Token,
    TokenMessage,
    Topic,
    TopicConfig,
    TopicHelper,
    Users,
    VcHelper,
} from '@guardian/common';
import { PolicyImportExportHelper } from './helpers/policy-import-export-helper.js';
import { PolicyConverterUtils } from './policy-converter-utils.js';
import { emptyNotifier, INotifier } from '../helpers/notifier.js';
import { ISerializedErrors } from './policy-validation-results-container.js';
import { PolicyServiceChannelsContainer } from '../helpers/policy-service-channels-container.js';
import { PolicyValidator } from '../policy-engine/block-validators/index.js';
import { publishPolicyTags } from '../api/tag.service.js';
import { importTag } from '../api/helpers/tag-import-export-helper.js';
import { createHederaToken } from '../api/token.service.js';
import { GuardiansService } from '../helpers/guardians.js';
import { findAndDryRunSchema, findAndPublishSchema, publishSystemSchemas } from '../api/helpers/schema-publish-helper.js';
import { deleteDemoSchema, deleteSchema, incrementSchemaVersion, sendSchemaMessage } from '../api/helpers/schema-helper.js';
import { AISuggestionsService } from '../helpers/ai-suggestions.js';
import { FilterObject } from '@mikro-orm/core';
import { publishFormula } from '../api/helpers/formulas-helpers.js';

/**
 * Result of publishing
 */
interface IPublishResult {
    /**
     * Policy Id
     */
    policyId: string;
    /**
     * Is policy valid
     */
    isValid: boolean;
    /**
     * Errors of validation
     */
    errors: ISerializedErrors;
}

/**
 * Policy engine service
 */
@Singleton
export class PolicyEngine extends NatsService {
    constructor(private readonly logger: PinoLogger) {
        super();
    }

    /**
     * Run ready event
     * @param policyId
     * @param data
     * @param logger
     * @param error
     */
    public static runReadyEvent(policyId: string, data: any, logger: PinoLogger, error?: any): void {
        new PolicyEngine(logger).runReadyEvent(policyId, data, error);
    }

    /**
     * Message queue name
     */
    public messageQueueName = 'policy-service-queue';

    /**
     * Reply subject
     * @private
     */
    public replySubject = 'policy-service-reply-' + GenerateUUIDv4();

    /**
     * Users helper
     * @private
     */
    // @Inject()
    private users: Users;

    /**
     * Policy ready callbacks
     * @private
     */
    private readonly policyReadyCallbacks: Map<string, (data: any, error?: any) => void> = new Map();

    /**
     * Policy initialization errors container
     * @private
     */
    private readonly policyInitializationErrors: Map<string, string> = new Map();

    /**
     * Initialization
     */
    public async init(): Promise<void> {
        await super.init();
        this.users = new Users()

        this.subscribe(PolicyEvents.POLICY_READY, (msg: any) => {
            PolicyEngine.runReadyEvent(msg.policyId, msg.data, this.logger, msg.error);
        });

        const policies = await DatabaseServer.getPolicies({
            status: {
                $in: [
                    PolicyType.PUBLISH,
                    PolicyType.DRY_RUN,
                    PolicyType.DISCONTINUED,
                    PolicyType.DEMO,
                ]
            }
        });
        await Promise.all(policies.map(async (policy) => {
            try {
                await this.generateModel(policy.id.toString());
            } catch (error) {
                await this.logger.error(error, ['GUARDIAN_SERVICE']);
            }
        }));
    }

    /**
     * Run ready event
     * @param policyId
     * @param data
     * @param error
     */
    private runReadyEvent(policyId: string, data?: any, error?: any): void {
        if (this.policyReadyCallbacks.has(policyId)) {
            this.policyReadyCallbacks.get(policyId)(data, error);
        }
    }

    /**
     * Check access
     * @param policy
     * @param user
     */
    public async accessPolicyCode(policy: Policy, user: IOwner): Promise<number> {
        if (!policy) {
            //Policy does not exist
            return 1;
        }
        if (user.owner !== policy.owner) {
            //Insufficient permissions
            return 2;
        }
        if (user.creator === policy.creator) {
            return 0;
        }
        const published = (policy.status === PolicyType.PUBLISH || policy.status === PolicyType.DISCONTINUED);
        const assigned = await DatabaseServer.getAssignedEntity(AssignedEntityType.Policy, policy.id, user.creator);

        switch (user.access) {
            case AccessType.ALL: {
                return 0;
            }
            case AccessType.ASSIGNED_OR_PUBLISHED: {
                return (published || assigned) ? 0 : 2;
            }
            case AccessType.PUBLISHED: {
                return (published) ? 0 : 2;
            }
            case AccessType.ASSIGNED: {
                return (assigned) ? 0 : 2;
            }
            case AccessType.ASSIGNED_AND_PUBLISHED: {
                return (published && assigned) ? 0 : 2;
            }
            case AccessType.NONE: {
                //Insufficient permissions
                return 2;
            }
            default: {
                //Insufficient permissions
                return 2;
            }
        }
    }

    /**
     * Check access
     * @param policy
     * @param user
     */
    public async accessPolicy(policy: Policy, user: IOwner, action: string): Promise<boolean> {
        const code = await this.accessPolicyCode(policy, user);
        if (code === 1) {
            throw new Error('Policy does not exist.');
        }
        if (code === 2) {
            throw new Error(`Insufficient permissions to ${action} the policy.`);
        }
        return true;
    }

    /**
     * Check access
     * @param policy
     * @param user
     */
    public async addAccessFilters(filters: { [field: string]: any }, user: IOwner): Promise<any> {
        filters.owner = user.owner;
        switch (user.access) {
            case AccessType.ALL: {
                break;
            }
            case AccessType.ASSIGNED_OR_PUBLISHED: {
                const assigned = await DatabaseServer.getAssignedEntities(user.creator, AssignedEntityType.Policy);
                const assignedMap = assigned.map((e) => e.entityId);
                filters.$or = [
                    { status: { $in: [PolicyType.PUBLISH, PolicyType.DISCONTINUED] } },
                    { id: { $in: assignedMap } }
                ];
                break;
            }
            case AccessType.PUBLISHED: {
                filters.status = { $in: [PolicyType.PUBLISH, PolicyType.DISCONTINUED] };
                break;
            }
            case AccessType.ASSIGNED: {
                const assigned = await DatabaseServer.getAssignedEntities(user.creator, AssignedEntityType.Policy);
                const assignedMap = assigned.map((e) => e.entityId);
                filters.id = { $in: assignedMap };
                break;
            }
            case AccessType.ASSIGNED_AND_PUBLISHED: {
                const assigned = await DatabaseServer.getAssignedEntities(user.creator, AssignedEntityType.Policy);
                const assignedMap = assigned.map((e) => e.entityId);
                filters.id = { $in: assignedMap };
                filters.status = { $in: [PolicyType.PUBLISH, PolicyType.DISCONTINUED] };
                break;
            }
            case AccessType.NONE: {
                filters.id = { $in: [] };
                break;
            }
            default: {
                filters.id = { $in: [] };
                break;
            }
        }
    }

    /**
     * Setup policy schemas
     * @param schemaIris Schema iris
     * @param policyTopicId Policy topic identifier
     */
    public async setupPolicySchemas(
        schemaIris: string[],
        policyTopicId: string,
        owner: IOwner
    ) {
        if (!Array.isArray(schemaIris)) {
            return;
        }
        const schemas = await DatabaseServer.getSchemas({
            iri: { $in: schemaIris },
            topicId: { $eq: 'draft' },
            owner: owner.owner
        });
        const users = new Users();
        for (const schema of schemas) {
            schema.topicId = policyTopicId;
            const topic = await TopicConfig.fromObject(
                await DatabaseServer.getTopicById(policyTopicId),
                true
            );
            const root = await users.getHederaAccount(owner.creator);
            const dependencySchemas = await DatabaseServer.getSchemas({
                $and: [
                    { iri: { $in: schema.defs } },
                    { iri: { $nin: schemaIris } },
                    { topicId: 'draft' },
                    { owner: owner.owner },
                ],
            } as FilterObject<SchemaCollection>);
            for (const dependencySchema of dependencySchemas) {
                dependencySchema.topicId = policyTopicId;
                await sendSchemaMessage(
                    owner,
                    root,
                    topic,
                    MessageAction.CreateSchema,
                    dependencySchema
                );
            }
            await DatabaseServer.updateSchemas(dependencySchemas);
            await sendSchemaMessage(
                owner,
                root,
                topic,
                MessageAction.CreateSchema,
                schema
            );
        }
        await DatabaseServer.updateSchemas(schemas);
    }

    /**
     * Create policy
     * @param data
     * @param owner
     * @param notifier
     * @param logger
     */
    // tslint:disable-next-line:completed-docs
    public async createPolicy(
        data: Policy & { policySchemas?: string[] },
        user: IOwner,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<Policy> {
        logger.info('Create Policy', ['GUARDIAN_SERVICE']);
        notifier.start('Save in DB');
        if (data) {
            delete data._id;
            delete data.id;
            delete data.status;
            delete data.owner;
            delete data.version;
            delete data.messageId;
        }
        const model = DatabaseServer.createPolicy(data);
        model.creator = user.creator;
        model.owner = user.owner;
        model.codeVersion = PolicyConverterUtils.VERSION;

        let artifacts = [];
        let tags = [];
        if (model.uuid) {
            const old = await DatabaseServer.getPolicy({
                uuid: model.uuid,
                version: model.previousVersion
            });
            await this.accessPolicy(old, user, 'create');
            artifacts = await DatabaseServer.getArtifacts({
                policyId: old.id
            });
            tags = await DatabaseServer.getTags({
                localTarget: old.id
            });
        } else {
            delete model.previousVersion;
            delete model.topicId;
        }

        let newTopic: Topic;
        notifier.completedAndStart('Resolve Hedera account');
        const root = await this.users.getHederaAccount(user.owner);
        notifier.completed();
        if (!model.topicId) {
            notifier.start('Create topic');
            logger.info('Create Policy: Create New Topic', ['GUARDIAN_SERVICE']);
            const parent = await TopicConfig.fromObject(
                await DatabaseServer.getTopicByType(user.owner, TopicType.UserTopic), true
            );
            const topicHelper = new TopicHelper(root.hederaAccountId, root.hederaAccountKey, root.signOptions);
            const topic = await topicHelper.create({
                type: TopicType.PolicyTopic,
                name: model.name || TopicType.PolicyTopic,
                description: model.topicDescription || TopicType.PolicyTopic,
                owner: user.owner,
                policyId: null,
                policyUUID: null
            });
            await topic.saveKeys();

            model.topicId = topic.topicId;

            notifier.completedAndStart('Create policy in Hedera');
            const messageServer = new MessageServer(root.hederaAccountId, root.hederaAccountKey, root.signOptions);
            const message = new PolicyMessage(MessageType.Policy, MessageAction.CreatePolicy);
            message.setDocument(model);
            const messageStatus = await messageServer
                .setTopicObject(parent)
                .sendMessage(message);

            notifier.completedAndStart('Link topic and policy');
            await topicHelper.twoWayLink(topic, parent, messageStatus.getId());

            notifier.completedAndStart('Publish schemas');
            const systemSchemas = await PolicyImportExportHelper.getSystemSchemas();

            notifier.info(`Found ${systemSchemas.length} schemas`);
            messageServer.setTopicObject(topic);

            await publishSystemSchemas(systemSchemas, messageServer, user, notifier);

            newTopic = await DatabaseServer.saveTopic(topic.toObject());
            notifier.completed();
        }

        notifier.start('Create Artifacts');
        const artifactsMap = new Map<string, string>();
        const addedArtifacts = [];
        for (const artifact of artifacts) {
            artifact.data = await DatabaseServer.getArtifactFileByUUID(artifact.uuid);
            delete artifact._id;
            delete artifact.id;
            const newArtifactUUID = GenerateUUIDv4();
            artifactsMap.set(artifact.uuid, newArtifactUUID);
            artifact.owner = model.owner;
            artifact.uuid = newArtifactUUID;
            artifact.type = getArtifactType(artifact.extention);
            addedArtifacts.push(await DatabaseServer.saveArtifact(artifact));
            await DatabaseServer.saveArtifactFile(newArtifactUUID, artifact.data);
        }
        replaceArtifactProperties(model.config, 'uuid', artifactsMap);

        notifier.start('Create tags');

        await importTag(tags, model.id.toString());

        notifier.completedAndStart('Saving in DB');
        let policy = await DatabaseServer.updatePolicy(model);

        if (newTopic) {
            newTopic.policyId = policy.id.toString();
            newTopic.policyUUID = policy.uuid;
            await DatabaseServer.updateTopic(newTopic);
        }

        const artifactObjects = []

        for (const addedArtifact of addedArtifacts) {
            addedArtifact.policyId = policy.id;

            artifactObjects.push(addedArtifact);
        }

        await DatabaseServer.saveArtifacts(artifactObjects);

        notifier.completedAndStart('Updating hash');
        policy = await PolicyImportExportHelper.updatePolicyComponents(policy, logger);

        notifier.completed();
        return policy;
    }

    /**
     * Clone policy
     * @param policyId
     * @param data
     * @param owner
     * @param notifier
     * @param logger
     */
    public async clonePolicy(
        policyId: string,
        data: any,
        user: IOwner,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<{
        /**
         * New Policy
         */
        policy: Policy;
        /**
         * Errors
         */
        errors: any[];
    }> {
        await logger.info('Create Policy', ['GUARDIAN_SERVICE']);

        const policy = await DatabaseServer.getPolicyById(policyId);
        await this.accessPolicy(policy, user, 'create');

        const schemas = await DatabaseServer.getSchemas({
            topicId: policy.topicId,
            readonly: false
        });

        const tokenIds = findAllEntities(policy.config, ['tokenId']);
        const tokens = await DatabaseServer.getTokens({
            tokenId: { $in: tokenIds }
        });

        const artifacts: any = await DatabaseServer.getArtifacts({
            policyId: policy.id
        });

        for (const artifact of artifacts) {
            artifact.data = await DatabaseServer.getArtifactFileByUUID(artifact.uuid);
        }

        const tags = await DatabaseServer.getTags({ localTarget: policyId });

        const tools = [];

        const dataToCreate: IPolicyComponents = {
            policy,
            schemas,
            tokens,
            artifacts,
            tools,
            tags,
            tests: [],
            formulas: []
        };
        return await PolicyImportExportHelper.importPolicy(
            dataToCreate,
            user,
            null,
            logger,
            data,
            null,
            false,
            notifier
        );
    }

    /**
     * Delete policy
     * @param policyId Policy ID
     * @param owner User
     * @param notifier Notifier
     * @param logger Notifier
     * @returns Result
     */
    public async deleteDemoPolicy(
        policyToDelete: Policy,
        user: IOwner,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<boolean> {
        await logger.info('Delete Policy', ['GUARDIAN_SERVICE']);

        if ((policyToDelete.status !== PolicyType.DEMO)) {
            throw new Error('Policy is not in demo status');
        }

        notifier.start('Delete policy instance');
        await this.destroyModel(policyToDelete.id.toString());
        const databaseServer = new DatabaseServer(policyToDelete.id.toString());
        await databaseServer.clear(true);

        notifier.start('Delete schemas');
        const schemasToDelete = await DatabaseServer.getSchemas({
            topicId: policyToDelete.topicId
        });
        for (const schema of schemasToDelete) {
            await deleteDemoSchema(schema.id, user, notifier);
        }

        notifier.completedAndStart('Delete artifacts');
        const artifactsToDelete = await new DatabaseServer().find(Artifact, {
            policyId: policyToDelete.id
        });
        for (const artifact of artifactsToDelete) {
            await DatabaseServer.removeArtifact(artifact);
        }

        notifier.completedAndStart('Delete tests');
        await DatabaseServer.deletePolicyTests(policyToDelete.id);

        notifier.completedAndStart('Delete policy from DB');
        await DatabaseServer.deletePolicy(policyToDelete.id);

        notifier.completed();
        return true;
    }

    /**
     * Delete policy
     * @param policyId Policy ID
     * @param owner User
     * @param notifier Notifier
     * @param logger Notifier
     *
     * @returns Result
     */
    public async deletePolicy(
        policyToDelete: Policy,
        user: IOwner,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<boolean> {
        logger.info('Delete Policy', ['GUARDIAN_SERVICE']);

        if ((policyToDelete.status !== PolicyType.DRAFT)) {
            throw new Error('Policy is not in draft status');
        }

        notifier.start('Delete schemas');
        const schemasToDelete = await DatabaseServer.getSchemas({
            topicId: policyToDelete.topicId,
            readonly: false
        });
        for (const schema of schemasToDelete) {
            if (schema.status === SchemaStatus.DRAFT) {
                await deleteSchema(schema.id, user, notifier);
            }
        }
        notifier.completedAndStart('Delete artifacts');

        const artifactsToDelete = await new DatabaseServer().find(Artifact, {
            policyId: policyToDelete.id
        });
        for (const artifact of artifactsToDelete) {
            await DatabaseServer.removeArtifact(artifact);
        }

        notifier.completedAndStart('Delete tests');
        await DatabaseServer.deletePolicyTests(policyToDelete.id);

        notifier.completedAndStart('Publishing delete policy message');
        const topic = await TopicConfig.fromObject(await DatabaseServer.getTopicById(policyToDelete.topicId), true);
        const users = new Users();
        const root = await users.getHederaAccount(user.creator);
        const messageServer = new MessageServer(root.hederaAccountId, root.hederaAccountKey, root.signOptions);
        const message = new PolicyMessage(MessageType.Policy, MessageAction.DeletePolicy);
        message.setDocument(policyToDelete);
        await messageServer.setTopicObject(topic)
            .sendMessage(message);

        notifier.completedAndStart('Delete policy from DB');
        await DatabaseServer.deletePolicy(policyToDelete.id);
        notifier.completed();
        return true;
    }

    /**
     * Policy schemas
     * @param model
     * @param user
     * @param root
     * @param notifier
     */
    public async publishSchemas(
        model: Policy,
        user: IOwner,
        root: IRootConfig,
        notifier: INotifier,
        schemaMap: Map<string, string>
    ): Promise<Policy> {
        const schemas = await DatabaseServer.getSchemas({ topicId: model.topicId });
        notifier.info(`Found ${schemas.length} schemas`);
        const schemaIRIs = schemas.map(s => s.iri);
        let num: number = 0;
        let skipped: number = 0;
        for (const schemaIRI of schemaIRIs) {
            const schema = await incrementSchemaVersion(schemaIRI, user);
            if (!schema || schema.status === SchemaStatus.PUBLISHED) {
                skipped++;
                continue;
            }
            const newSchema = await findAndPublishSchema(
                schema.id,
                schema.version,
                user,
                root,
                emptyNotifier(),
                schemaMap
            );
            const name = newSchema.name;
            num++;
            notifier.info(`Schema ${num} (${name || '-'}) published`);
        }

        if (skipped) {
            notifier.info(`Skip published ${skipped}`);
        }
        return model;
    }

    /**
     * Policy Formulas
     * @param model
     * @param user
     * @param root
     * @param notifier
     */
    public async publishFormulas(
        model: Policy,
        user: IOwner,
        root: IRootConfig,
        notifier: INotifier,
        schemaMap: Map<string, string>
    ): Promise<Policy> {
        const formulas = await DatabaseServer.getFormulas({ policyTopicId: model.topicId });
        notifier.info(`Found ${formulas.length} formulas`);

        let num: number = 0;
        let skipped: number = 0;
        for (const formula of formulas) {
            if (formula.status === EntityStatus.PUBLISHED) {
                skipped++;
                continue;
            }

            for (const [oldId, newId] of schemaMap.entries()) {
                FormulaImportExport.replaceIds(formula.config, oldId, newId);
            }

            const newFormula = await publishFormula(
                formula,
                user,
                root,
                emptyNotifier()
            );

            const name = newFormula.name;
            num++;
            notifier.info(`Formula ${num} (${name || '-'}) published`);
        }

        if (skipped) {
            notifier.info(`Skip published ${skipped}`);
        }
        return model;
    }

    /**
     * Policy Formulas
     * @param model
     * @param user
     * @param root
     * @param notifier
     */
    public async updateSchemaId(
        model: Policy,
        schemaMap: Map<string, string>
    ): Promise<Policy> {
        for (const [oldId, newId] of schemaMap.entries()) {
            replaceAllEntities(model.config, SchemaFields, oldId, newId);
            replaceAllVariables(model.config, 'Schema', oldId, newId);

            if (model.projectSchema === oldId) {
                model.projectSchema = newId;
            }
        }
        return model;
    }

    /**
     * Dry run Policy schemas
     * @param model
     * @param user
     */
    public async dryRunSchemas(
        model: Policy,
        user: IOwner
    ): Promise<Policy> {
        const schemas = await DatabaseServer.getSchemas({ topicId: model.topicId });
        for (const schema of schemas) {
            if (schema.status === SchemaStatus.PUBLISHED) {
                continue;
            }
            await findAndDryRunSchema(schema, schema.version, user);
        }
        return model;
    }

    /**
     * Publish policy
     * @param model
     * @param user
     * @param version
     * @param notifier
     * @param logger
     */
    public async publishPolicy(
        model: Policy,
        user: IOwner,
        version: string,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<Policy> {
        await logger.info('Publish Policy', ['GUARDIAN_SERVICE']);
        notifier.start('Resolve Hedera account');
        const root = await this.users.getHederaAccount(user.creator);

        notifier.completedAndStart('Find topic');

        model.version = version;

        const topic = await TopicConfig.fromObject(await DatabaseServer.getTopicById(model.topicId), true);
        const messageServer = new MessageServer(root.hederaAccountId, root.hederaAccountKey, root.signOptions)
            .setTopicObject(topic);

        const schemaMap = new Map<string, string>();
        notifier.completedAndStart('Publish schemas');
        try {
            model = await this.publishSchemas(model, user, root, notifier, schemaMap);
        } catch (error) {
            model.status = PolicyType.PUBLISH_ERROR;
            model.version = '';
            model.hash = '';
            model = await DatabaseServer.updatePolicy(model);
            throw error;
        }

        notifier.completedAndStart('Update UUID');
        try {
            model = await this.updateSchemaId(model, schemaMap);
        } catch (error) {
            model.status = PolicyType.PUBLISH_ERROR;
            model.version = '';
            model.hash = '';
            model = await DatabaseServer.updatePolicy(model);
            throw error;
        }

        notifier.completedAndStart('Publish formulas');
        try {
            model = await this.publishFormulas(model, user, root, notifier, schemaMap);
        } catch (error) {
            model.status = PolicyType.PUBLISH_ERROR;
            model.version = '';
            model.hash = '';
            model = await DatabaseServer.updatePolicy(model);
            throw error;
        }

        try {
            notifier.completedAndStart('Generate file');
            this.regenerateIds(model.config);

            notifier.completedAndStart('Token');
            const tokenIds = findAllEntities(model.config, ['tokenId']);
            const tokens = await DatabaseServer.getTokens({ tokenId: { $in: tokenIds }, owner: model.owner });

            for (const token of tokens) {
                let _token = token;
                if (token.draftToken) {
                    const oldId = token.tokenId;
                    const newToken = await createHederaToken({ ...token, changeSupply: true }, root);

                    _token = await new DatabaseServer().update(Token, token?.id, newToken);

                    replaceAllEntities(model.config, ['tokenId'], oldId, newToken.tokenId);
                    replaceAllVariables(model.config, 'Token', oldId, newToken.tokenId);

                    model = await DatabaseServer.updatePolicy(model);
                }

                const tokenMessage = new TokenMessage(MessageAction.UseToken);
                tokenMessage.setDocument(_token);
                await messageServer
                    .sendMessage(tokenMessage, true, null, user.id);
            }
            const topicHelper = new TopicHelper(root.hederaAccountId, root.hederaAccountKey, root.signOptions);

            const createInstanceTopic = async () => {
                notifier.completedAndStart('Create instance topic');
                rootTopic = await topicHelper.create({
                    type: TopicType.InstancePolicyTopic,
                    name: model.name || TopicType.InstancePolicyTopic,
                    description: model.topicDescription || TopicType.InstancePolicyTopic,
                    owner: user.creator,
                    policyId: model.id.toString(),
                    policyUUID: model.uuid
                });
                await rootTopic.saveKeys();
                await DatabaseServer.saveTopic(rootTopic.toObject());
                model.instanceTopicId = rootTopic.topicId;
            }

            let rootTopic;
            if (model.status === PolicyType.PUBLISH_ERROR) {
                if (model.instanceTopicId) {
                    const topicEntity = await DatabaseServer.getTopicById(model.instanceTopicId);
                    rootTopic = await TopicConfig.fromObject(topicEntity);
                }
                if (!rootTopic) {
                    await createInstanceTopic();
                }
            } else {
                await createInstanceTopic();
            }

            const createSynchronizationTopic = async () => {
                notifier.completedAndStart('Create synchronization topic');
                const synchronizationTopic = await topicHelper.create({
                    type: TopicType.SynchronizationTopic,
                    name: model.name || TopicType.SynchronizationTopic,
                    description: model.topicDescription || TopicType.InstancePolicyTopic,
                    owner: user.creator,
                    policyId: model.id.toString(),
                    policyUUID: model.uuid
                }, { admin: true, submit: false });
                await synchronizationTopic.saveKeys();
                await DatabaseServer.saveTopic(synchronizationTopic.toObject());
                model.synchronizationTopicId = synchronizationTopic.topicId;
            }
            if (model.status === PolicyType.PUBLISH_ERROR) {
                if (!!model.synchronizationTopicId) {
                    await createSynchronizationTopic();
                }
            } else {
                await createSynchronizationTopic();
            }

            const zip = await PolicyImportExport.generate(model);
            const buffer = await zip.generateAsync({
                type: 'arraybuffer',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 3
                }
            });

            notifier.completedAndStart('Publish policy');
            const message = new PolicyMessage(MessageType.InstancePolicy, MessageAction.PublishPolicy);
            message.setDocument(model, buffer);
            const result = await messageServer
                .sendMessage(message, true, null, user.id);
            model.messageId = result.getId();

            notifier.completedAndStart('Link topic and policy');
            await topicHelper.twoWayLink(rootTopic, topic, result.getId(), user.id);

            notifier.completedAndStart('Create VC');
            const messageId = result.getId();
            const url = result.getUrl();
            const policySchema = await DatabaseServer.getSchemaByType(model.topicId, SchemaEntity.POLICY);
            const vcHelper = new VcHelper();
            let credentialSubject: any = {
                id: messageId,
                name: model.name || '',
                description: model.description || '',
                topicDescription: model.topicDescription || '',
                version: model.version || '',
                policyTag: model.policyTag || '',
                owner: model.owner || '',
                cid: url.cid || '',
                url: url.url || '',
                uuid: model.uuid || '',
                operation: 'PUBLISH'
            }
            if (policySchema) {
                const schemaObject = new Schema(policySchema);
                credentialSubject = SchemaHelper.updateObjectContext(schemaObject, credentialSubject);
            }

            const didDocument = await vcHelper.loadDidDocument(user.creator);
            const vc = await vcHelper.createVerifiableCredential(credentialSubject, didDocument, null, null);
            await DatabaseServer.saveVC({
                hash: vc.toCredentialHash(),
                owner: user.creator,
                document: vc.toJsonTree(),
                type: SchemaEntity.POLICY,
                policyId: `${model.id}`
            });

            logger.info('Published Policy', ['GUARDIAN_SERVICE']);
        } catch (error) {
            model.status = PolicyType.PUBLISH_ERROR;
            model.version = '';
            model.hash = '';
            model = await DatabaseServer.updatePolicy(model);
            throw error
        }

        notifier.completedAndStart('Publish tags');
        try {
            await publishPolicyTags(model, user, root);
        } catch (error) {
            logger.error(error, ['GUARDIAN_SERVICE, TAGS']);
        }

        notifier.completedAndStart('Saving in DB');
        model.status = PolicyType.PUBLISH;
        let retVal = await DatabaseServer.updatePolicy(model);

        notifier.completedAndStart('Updating hash');
        retVal = await PolicyImportExportHelper.updatePolicyComponents(retVal, logger);

        notifier.completed();
        return retVal
    }

    /**
     * Dry Run policy
     * @param model
     * @param user
     * @param version
     * @param demo
     * @param logger
     */
    public async dryRunPolicy(
        model: Policy,
        user: IOwner,
        version: string,
        demo: boolean,
        logger: PinoLogger
    ): Promise<Policy> {
        if (demo) {
            logger.info('Demo Policy', ['GUARDIAN_SERVICE']);
        } else {
            logger.info('Dry-run Policy', ['GUARDIAN_SERVICE']);
        }

        const dryRunId = model.id.toString();
        const databaseServer = new DatabaseServer(dryRunId);

        //Create Services
        const root = await this.users.getHederaAccount(user.owner);
        const topic = await TopicConfig.fromObject(
            await DatabaseServer.getTopicById(model.topicId), !demo
        );
        const messageServer = new MessageServer(
            root.hederaAccountId, root.hederaAccountKey, root.signOptions, dryRunId
        ).setTopicObject(topic);
        const topicHelper = new TopicHelper(root.hederaAccountId, root.hederaAccountKey, root.signOptions, dryRunId);

        //'Publish' policy schemas
        model = await this.dryRunSchemas(model, user);
        model.status = demo ? PolicyType.DEMO : PolicyType.DRY_RUN;
        model.version = version;
        this.regenerateIds(model.config);

        //Create instance topic
        const rootTopic = await topicHelper.create({
            type: TopicType.InstancePolicyTopic,
            name: model.name || TopicType.InstancePolicyTopic,
            description: model.topicDescription || TopicType.InstancePolicyTopic,
            owner: user.owner,
            policyId: dryRunId,
            policyUUID: model.uuid
        });
        await rootTopic.saveKeys();
        await databaseServer.saveTopic(rootTopic.toObject());
        model.instanceTopicId = rootTopic.topicId;

        //Send Message
        const zip = await PolicyImportExport.generate(model);
        const buffer = await zip.generateAsync({
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 3
            }
        });
        const message = new PolicyMessage(MessageType.InstancePolicy, MessageAction.PublishPolicy);
        message.setDocument(model, buffer);
        const result = await messageServer.sendMessage(message);

        //Link topic and message
        await topicHelper.twoWayLink(rootTopic, topic, result.getId());

        //Create Policy VC
        const messageId = result.getId();
        const url = result.getUrl();
        let credentialSubject: any = {
            id: messageId,
            name: model.name || '',
            description: model.description || '',
            topicDescription: model.topicDescription || '',
            version: model.version || '',
            policyTag: model.policyTag || '',
            owner: model.owner || '',
            cid: url.cid || '',
            url: url.url || '',
            uuid: model.uuid || '',
            operation: 'PUBLISH'
        }
        const policySchema = await DatabaseServer.getSchemaByType(model.topicId, SchemaEntity.POLICY);
        if (policySchema) {
            const schemaObject = new Schema(policySchema);
            credentialSubject = SchemaHelper.updateObjectContext(schemaObject, credentialSubject);
        }
        const vcHelper = new VcHelper();
        const didDocument = await vcHelper.loadDidDocument(user.owner);
        const vc = await vcHelper.createVerifiableCredential(credentialSubject, didDocument, null, null);
        await databaseServer.saveVC({
            hash: vc.toCredentialHash(),
            owner: user.owner,
            document: vc.toJsonTree(),
            type: SchemaEntity.POLICY,
            policyId: `${model.id}`
        });

        //Create default user
        await databaseServer.createVirtualUser(
            'Administrator',
            root.did,
            root.hederaAccountId,
            root.hederaAccountKey,
            true
        );

        //Update dry-run table (mark readonly rows)
        await DatabaseServer.setSystemMode(dryRunId, true);

        //Update Policy hash and status
        let retVal = await DatabaseServer.updatePolicy(model);
        retVal = await PolicyImportExportHelper.updatePolicyComponents(retVal, logger);

        logger.info('Run Policy', ['GUARDIAN_SERVICE']);

        return retVal;
    }

    /**
     * Validate and publish policy
     * @param model
     * @param policyId
     * @param owner
     * @param notifier
     * @param logger
     */
    public async validateAndPublishPolicy(
        model: any,
        policyId: string,
        owner: IOwner,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<IPublishResult> {
        const version = model.policyVersion;

        notifier.start('Find and validate policy');
        const policy = await DatabaseServer.getPolicyById(policyId);
        await this.accessPolicy(policy, owner, 'read');

        if (!policy.config) {
            throw new Error('The policy is empty');
        }
        if (policy.status === PolicyType.PUBLISH) {
            throw new Error(`Policy already published`);
        }
        if (policy.status === PolicyType.DISCONTINUED) {
            throw new Error(`Policy is discontinued`);
        }
        if (policy.status === PolicyType.DEMO) {
            throw new Error(`Policy imported in demo mode`);
        }
        if (!ModelHelper.checkVersionFormat(version)) {
            throw new Error('Invalid version format');
        }
        if (ModelHelper.versionCompare(version, policy.previousVersion) <= 0) {
            throw new Error('Version must be greater than ' + policy.previousVersion);
        }

        const countModels = await DatabaseServer.getPolicyCount({
            version,
            uuid: policy.uuid
        });
        if (countModels > 0) {
            throw new Error('Policy with current version already was published');
        }

        const errors = await this.validateModel(policyId);
        const isValid = !errors.blocks.some(block => !block.isValid);
        notifier.completed();
        if (isValid) {
            if (policy.status === PolicyType.DRY_RUN) {
                await this.destroyModel(policyId);
                await DatabaseServer.clearDryRun(policy.id.toString(), true);
            }
            const newPolicy = await this.publishPolicy(policy, owner, version, notifier, logger);

            if (newPolicy.status === PolicyType.PUBLISH) {
                new AISuggestionsService().rebuildAIVector().then();
            }

            await this.generateModel(newPolicy.id.toString());
            const users = await new Users().getUsersBySrId(owner.owner);

            await Promise.all(
                users.map(
                    async (user) =>
                        await NotificationHelper.info(
                            'Policy published',
                            'New policy published',
                            user.id,
                            NotificationAction.POLICY_VIEW,
                            newPolicy.id.toString()
                        )
                )
            );

            return {
                policyId: newPolicy.id.toString(),
                isValid,
                errors
            };
        } else {
            return {
                policyId: policy.id.toString(),
                isValid,
                errors
            };
        }
    }

    /**
     * Prepare policy for preview by message
     * @param messageId
     * @param user
     * @param notifier
     * @param logger
     */
    public async preparePolicyPreviewMessage(
        messageId: string,
        user: IOwner,
        notifier: INotifier,
        logger: PinoLogger
    ): Promise<any> {
        notifier.start('Resolve Hedera account');
        if (!messageId) {
            throw new Error('Policy ID in body is empty');
        }

        await logger.info(`Import policy by message`, ['GUARDIAN_SERVICE']);

        const root = await this.users.getHederaAccount(user.creator);

        const messageServer = new MessageServer(root.hederaAccountId, root.hederaAccountKey, root.signOptions);
        const message = await messageServer.getMessage<PolicyMessage>(messageId);
        if (message.type !== MessageType.InstancePolicy) {
            throw new Error('Invalid Message Type');
        }

        if (!message.document) {
            throw new Error('file in body is empty');
        }

        notifier.completedAndStart('Load policy files');
        const newVersions: any = [];
        if (message.version) {
            const anotherVersions = await messageServer.getMessages<PolicyMessage>(
                message.getTopicId(), MessageType.InstancePolicy, MessageAction.PublishPolicy
            );
            for (const element of anotherVersions) {
                if (element.version && ModelHelper.versionCompare(element.version, message.version) === 1) {
                    newVersions.push({
                        messageId: element.getId(),
                        version: element.version
                    });
                }
            }
            ;
        }

        // const tagMessages = await messageServer.getMessages<TagMessage>(message.policyTopicId, MessageType.Tag, MessageAction.PublishTag);

        notifier.completedAndStart('Parse policy files');
        const policyToImport: any = await PolicyImportExport.parseZipFile(message.document, true);
        if (newVersions.length !== 0) {
            policyToImport.newVersions = newVersions.reverse();
        }

        notifier.completed();
        return policyToImport;
    }

    /**
     * Import policy by message
     * @param messageId
     * @param user
     * @param hederaAccount
     * @param versionOfTopicId
     * @param logger
     * @param notifier
     * @param metadata
     */
    public async importPolicyMessage(
        messageId: string,
        user: IOwner,
        hederaAccount: IRootConfig,
        versionOfTopicId: string,
        logger: PinoLogger,
        metadata: PolicyToolMetadata = null,
        demo: boolean = false,
        notifier: INotifier = emptyNotifier()
    ): Promise<{
        /**
         * New Policy
         */
        policy: Policy;
        /**
         * Errors
         */
        errors: any[];
    }> {
        notifier.start('Load from IPFS');
        const messageServer = new MessageServer(hederaAccount.hederaAccountId, hederaAccount.hederaAccountKey, hederaAccount.signOptions);
        const message = await messageServer.getMessage<PolicyMessage>(messageId);
        if (message.type !== MessageType.InstancePolicy) {
            throw new Error('Invalid Message Type');
        }
        if (!message.document) {
            throw new Error('File in body is empty');
        }

        const tagMessages = await messageServer.getMessages<TagMessage>(message.policyTopicId, MessageType.Tag, MessageAction.PublishTag);

        notifier.completedAndStart('File parsing');
        const policyToImport = await PolicyImportExport.parseZipFile(message.document, true);

        if (!Array.isArray(policyToImport.tags)) {
            policyToImport.tags = [];
        }
        for (const tag of tagMessages) {
            if (tag.entity === TagType.Policy && tag.target !== messageId) {
                continue;
            }
            policyToImport.tags.push({
                uuid: tag.uuid,
                name: tag.name,
                description: tag.description,
                owner: tag.owner,
                entity: tag.entity,
                target: tag.target,
                status: 'History',
                topicId: tag.topicId,
                messageId: tag.id,
                date: tag.date,
                document: null,
                uri: null,
                id: null
            } as any);
        }
        notifier.completed();
        return await PolicyImportExportHelper.importPolicy(
            policyToImport,
            user,
            versionOfTopicId,
            logger,
            null,
            metadata,
            demo,
            notifier
        );
    }

    /**
     * Destroy Model
     * @param policyId
     */
    public async destroyModel(policyId: string): Promise<void> {
        PolicyServiceChannelsContainer.deletePolicyServiceChannel(policyId);
        new GuardiansService().sendPolicyMessage(PolicyEvents.DELETE_POLICY, policyId, {});
    }

    /**
     * Generate Model
     * @param policyId
     */
    public async generateModel(policyId: string): Promise<any> {
        const policy = await DatabaseServer.getPolicyById(policyId);
        if (!policy || (typeof policy !== 'object')) {
            throw new Error('Policy was not exist');
        }

        const exist = await new GuardiansService().checkIfPolicyAlive(policyId);

        if (!exist) {
            let confirmed: boolean;

            try {
                const r = await this.sendMessageWithTimeout<any>(PolicyEvents.GENERATE_POLICY, 1000, {
                    policyId,
                    skipRegistration: false
                });
                confirmed = r.confirmed;
            } catch (e) {
                confirmed = false
                console.error(e.message);
            }

            if (confirmed) {
                return new Promise((resolve, reject) => {
                    this.policyReadyCallbacks.set(policyId, (data, error) => {
                        if (error) {
                            this.policyInitializationErrors.set(policyId, error);
                            reject(new Error(error));
                        }
                        resolve(data);
                        this.policyReadyCallbacks.delete(policyId);
                    })
                });
            } else {
                await new Promise(resolve => setTimeout(resolve, 10000));

                return this.generateModel(policyId);
            }
        } else {
            return Promise.resolve();
        }
    }

    /**
     * Regenerate policy model
     * @param policyId Policy identifier
     */
    public async regenerateModel(policyId: string): Promise<any> {
        await this.destroyModel(policyId);
        return await this.generateModel(policyId);
    }

    /**
     * Validate Model
     * @param policy
     */
    public async validateModel(policy: Policy | string): Promise<ISerializedErrors> {
        let policyId: string;
        if (typeof policy === 'string') {
            policyId = policy
            policy = await DatabaseServer.getPolicyById(policyId);
        } else {
            if (!policy.id) {
                policy.id = GenerateUUIDv4();
            }
            policyId = policy.id.toString();
        }
        const policyValidator = new PolicyValidator(policy);
        await policyValidator.build(policy);
        await policyValidator.validate();
        return policyValidator.getSerializedErrors();
    }

    /**
     * Create Multi Policy
     * @param policy
     * @param userAccount
     * @param data
     */
    public async createMultiPolicy(
        policy: Policy,
        userAccount: IRootConfig,
        root: IRootConfig,
        data: any,
    ): Promise<MultiPolicy> {

        const multipleConfig = DatabaseServer.createMultiPolicy({
            uuid: GenerateUUIDv4(),
            instanceTopicId: policy.instanceTopicId,
            mainPolicyTopicId: data.mainPolicyTopicId,
            synchronizationTopicId: data.synchronizationTopicId,
            owner: userAccount.did,
            user: userAccount.hederaAccountId,
            policyOwner: root.hederaAccountId,
            type: data.mainPolicyTopicId === policy.instanceTopicId ? 'Main' : 'Sub',
        } as MultiPolicy);

        const message = new SynchronizationMessage(MessageAction.CreateMultiPolicy);
        message.setDocument(multipleConfig);
        const messageServer = new MessageServer(userAccount.hederaAccountId, userAccount.hederaAccountKey, userAccount.signOptions);
        const topic = new TopicConfig({ topicId: multipleConfig.synchronizationTopicId }, null, null);
        await messageServer
            .setTopicObject(topic)
            .sendMessage(message);

        return await DatabaseServer.saveMultiPolicy(multipleConfig);
    }

    /**
     * Regenerate IDs
     * @param block
     */
    public regenerateIds(block: any) {
        block.id = GenerateUUIDv4();
        if (Array.isArray(block.children)) {
            for (const child of block.children) {
                this.regenerateIds(child);
            }
        }
    }

    /**
     * Get policy errors
     * @param policyId
     */
    public getPolicyError(policyId: string): string | null {
        if (this.policyInitializationErrors.has(policyId)) {
            return this.policyInitializationErrors.get(policyId)
        }
        return null;
    }

    public async startDemo(
        policy: Policy,
        owner: IOwner,
        logger: PinoLogger,
        notifier: INotifier = emptyNotifier(),
    ): Promise<void> {
        notifier.completedAndStart('Validate policy');
        const blockErrors = await this.validateModel(policy.id);
        const errors = blockErrors.blocks
            .filter((block) => !block.isValid && block.errors)
            .map((block) => {
                return {
                    type: 'Block',
                    uuid: block.id,
                    name: block.name,
                    error: JSON.stringify(block.errors)
                }
            })
        if (errors.length) {
            const message = PolicyImportExportHelper.errorsMessage(errors);
            throw new Error(message);
        }

        notifier.completedAndStart('Update policy model');
        const model = await DatabaseServer.getPolicyById(policy.id);
        const newPolicy = await this.dryRunPolicy(model, owner, 'Demo', true, logger);
        notifier.completedAndStart('Run policy');
        await this.generateModel(newPolicy.id.toString());
    }
}
