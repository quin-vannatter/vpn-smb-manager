import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize, first } from 'rxjs';
import { AppComponent } from '../app.component';
import { LoadingComponent } from '../loading/loading.component';
import { User } from '../models/user.interface';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';
import { TorrentService } from '../services/torrent.service';
import { FormControl } from '@angular/forms';
import { Torrent, TorrentSearch } from '../models/torrent.interface';

export const PING_INT = 5000;

@Component({
  selector: 'app-torrents',
  templateUrl: './torrents.component.html',
  styleUrls: ['./torrents.component.css']
})
export class TorrentsComponent extends AppComponent {
  
  search = new FormControl();
  isSearching: boolean = false;

  currentUser?: User;
  torrentTableData: Torrent[] = [];
  searchTableData: TorrentSearch[] = [];

  isLoggedIn: boolean = false;
  timeout?: NodeJS.Timeout;

  constructor(
    private userService: UserService,
    private torrentService: TorrentService,
    private certificateService: CertificateService,
    private dialog: MatDialog) {
    super();
    userService.isLoggedIn().pipe(first()).subscribe(result => {
      this.isLoggedIn = result;
      if (this.isLoggedIn) {
        this.getTorrentData();
      }
    });
    userService.getCurrentUser().pipe(first(user => user != undefined)).subscribe(user => this.currentUser = user);
  }

  isMobile() {
    return this.certificateService.isMobile();
  }

  getTitle(name: string) {
    return name[0].toUpperCase() + name.substring(1).toLowerCase();
  }

  getSearchTableKeys() {
    return Object.keys(this.searchTableData?.[0] || {})
  }

  getTorrentData(): void {
    this.torrentService.getTorrents().pipe(first()).subscribe(result => {
      if (result != undefined) {
        this.torrentTableData = result as Torrent[];
      }
      if (this.timeout != undefined) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => this.getTorrentData(), PING_INT);
    });
  }

  getTorrentsNoIdle() {
    return this.torrentTableData.filter(x => x.status !== "Idle")
  }

  clearResults(): void {
    this.searchTableData = [];
  }

  searchTorrents(): void {
    if (this.search.valid && !this.isSearching) {
      this.isSearching = true;
      const dialogRef = this.dialog.open(LoadingComponent);
      this.torrentService.searchTorrents(this.search.value.trim()).pipe(finalize(() => {
        this.isSearching = false;
        dialogRef.close();
      })).subscribe(result => {
        if (result != undefined) {
          this.searchTableData = result.filter(x => x.seeders !== "0");
        }
      });
    }
  }

  getPercentage(torrent: Torrent) {
    return /^[0-9]{1,3}/.exec(torrent.done)?.[0] ?? 0;
  }

  addTorrent(torrent: TorrentSearch): void {
    const dialogRef = this.dialog.open(LoadingComponent);
    this.torrentService.addTorrent(torrent.magnet).pipe(finalize(() => dialogRef.close()))
      .subscribe(() => {
        this.searchTableData.splice(this.searchTableData.findIndex(x => x === torrent), 1);
        this.getTorrentData();
      });
  }

  deleteTorrent(torrent: Torrent) {
    const dialogRef = this.dialog.open(LoadingComponent);
    this.torrentService.removeTorrent(torrent.id).pipe(finalize(() => dialogRef.close()))
      .subscribe(() => this.getTorrentData());
  }

  getCurrentUser(): void {
    this.userService.getCurrentUser().pipe(first(user => user != undefined)).subscribe(user => {
      this.currentUser = user;
    });
  }
}
