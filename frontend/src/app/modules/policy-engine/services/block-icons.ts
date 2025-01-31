import {BlockType} from '@guardian/interfaces'

const BlockIcons: { [type: string]: string } = {};

BlockIcons[BlockType.Container] = 'folder-open';
BlockIcons[BlockType.Step] = 'sort-alt';
BlockIcons[BlockType.PolicyRoles] = 'users';
BlockIcons[BlockType.GroupManagerBlock] = 'users';
BlockIcons[BlockType.Information] = 'info-circle';
BlockIcons[BlockType.Action] = 'bolt';
BlockIcons[BlockType.ButtonBlock] = 'circle-on';
BlockIcons[BlockType.ButtonBlockAddon] = 'circle-on';
BlockIcons[BlockType.DropdownBlockAddon] = 'list';
BlockIcons[BlockType.Switch] = 'sliders-h';
BlockIcons[BlockType.HttpRequest] = 'globe';
BlockIcons[BlockType.DocumentsViewer] = 'table';
BlockIcons[BlockType.Request] = 'file';
BlockIcons[BlockType.RequestBlockAddon] = 'file';
BlockIcons[BlockType.Upload] = 'upload';
BlockIcons[BlockType.MultiSignBlock] = 'check-square';
BlockIcons[BlockType.SendToGuardian] = 'send';
BlockIcons[BlockType.ExternalData] = 'cloud';
BlockIcons[BlockType.ExternalTopic] = 'cloud';
BlockIcons[BlockType.AggregateDocument] = 'calendar';
BlockIcons[BlockType.ReassigningBlock] = 'copy';
BlockIcons[BlockType.RevokeBlock] = 'refresh';
BlockIcons[BlockType.RevocationBlock] = 'refresh';
BlockIcons[BlockType.SetRelationshipsBlock] = 'cog';
BlockIcons[BlockType.SplitBlock] = 'clone';
BlockIcons[BlockType.FiltersAddon] = 'filter';
BlockIcons[BlockType.DocumentsSourceAddon] = 'database';
BlockIcons[BlockType.PaginationAddon] = 'clone';
BlockIcons[BlockType.HistoryAddon] = 'history';
BlockIcons[BlockType.SelectiveAttributes] = 'folder';
BlockIcons[BlockType.TimerBlock] = 'clock';
BlockIcons[BlockType.DocumentValidatorBlock] = 'check-circle';
BlockIcons[BlockType.CreateToken] = 'dollar';
BlockIcons[BlockType.Mint] = 'money-bill';
BlockIcons[BlockType.Wipe] = 'trash';
BlockIcons[BlockType.TokenActionBlock] = 'key';
BlockIcons[BlockType.TokenConfirmationBlock] = 'key';
BlockIcons[BlockType.ImpactAddon] = 'file';
BlockIcons[BlockType.Calculate] = 'chart-bar';
BlockIcons[BlockType.CustomLogicBlock] = 'chart-bar';
BlockIcons[BlockType.CalculateMathAddon] = 'calculator';
BlockIcons[BlockType.CalculateMathVariables] = 'calculator';
BlockIcons[BlockType.MessagesReportBlock] = 'chart-line';
BlockIcons[BlockType.Report] = 'chart-line';
BlockIcons[BlockType.ReportItem] = 'list';
BlockIcons[BlockType.TagsManager] = 'tags';
BlockIcons[BlockType.NotificationBlock] = 'bell';
BlockIcons[BlockType.ExtractDataBlock] = 'search';
BlockIcons[BlockType.Tool] = 'wrench';
BlockIcons[BlockType.Module] = 'folder';

export default BlockIcons;
