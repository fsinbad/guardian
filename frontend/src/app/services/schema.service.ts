import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ISchema, Schema, SchemaEntity } from 'interfaces';
import { Observable } from 'rxjs';

/**
 * Services for working from Schemes.
 */
@Injectable()
export class SchemaService {
  constructor(
    private http: HttpClient
  ) {
  }

  public createSchema(schema: Schema): Observable<ISchema[]> {
    const data = {
      uuid: schema.uuid,
      hash: schema.hash,
      name: schema.name,
      entity: schema.entity,
      document: schema.document
    }
    return this.http.post<any[]>('/api/schema/create', data);
  }

  public updateSchema(schema: Schema, id?: string): Observable<ISchema[]> {
    const data = {
      id: id || schema.id,
      uuid: schema.uuid,
      hash: schema.hash,
      name: schema.name,
      entity: schema.entity,
      document: schema.document
    }
    return this.http.post<any[]>('/api/schema/update', data);
  }

  public getSchemes(): Observable<ISchema[]> {
    return this.http.get<any[]>('/api/schema');
  }

  public importSchemes(schemes: any[]): Observable<ISchema[]> {
    return this.http.post<any[]>(`/api/schema/import`, { schemes });
  }

  public exportSchemes(ids: string[]): Observable<any> {
    return this.http.post<any[]>(`/api/schema/export`, { ids });
  }

  public publishSchema(id: string): Observable<ISchema[]> {
    return this.http.post<any[]>('/api/schema/publish', { id });
  }

  public unpublishedSchema(id: string): Observable<ISchema[]> {
    return this.http.post<any[]>('/api/schema/unpublished', { id });
  }

  public deleteSchema(id: string): Observable<ISchema[]> {
    return this.http.post<any[]>('/api/schema/delete', { id });
  }
}