import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BaseService } from './base.service';
import { Observable } from 'rxjs';
import { Torrent } from '../models/torrent.interface';
import { MatDialog } from '@angular/material/dialog';

@Injectable({
  providedIn: 'root'
})
export class TorrentService extends BaseService {

  protected getEndpoint(): string {
      return "torrents";
  }

  constructor(http: HttpClient, router: Router, dialog: MatDialog) {
    super(http, router, dialog);
  }

  getTorrents(): Observable<Torrent[] | undefined> {
    return this.get<Torrent[] | undefined>();
  }

  searchTorrents(search: string): Observable<Torrent[]> {
    return this.get<Torrent[]>(`search/${encodeURIComponent(search)}`)
  }
  
  addTorrent(magnet: string): Observable<any> {
    return this.post({ magnet });
  }

  removeTorrent(id: string): Observable<any> {
    return this.delete(id);
  }
}
