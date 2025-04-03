import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize, first, zip } from 'rxjs';
import { AppComponent } from '../app.component';
import { InviteCodeComponent } from '../invite-code/invite-code.component';
import { LoadingComponent } from '../loading/loading.component';
import { User } from '../models/user.interface';
import { ServerInfoComponent } from '../server-info/server-info.component';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';
import { CertificatesComponent } from '../certificates/certificates.component';
import { TorrentService } from '../services/torrent.service';
import { FormControl } from '@angular/forms';
import { Torrent } from '../models/torrent.interface';

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
  searchTableData: Torrent[] = [];

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

  searchTorrents(): void {
    if (this.search.valid && !this.isSearching) {
      this.isSearching = true;
      const dialogRef = this.dialog.open(LoadingComponent);
      this.torrentService.searchTorrents(this.search.value.trim()).pipe(finalize(() => {
        this.isSearching = false;
        dialogRef.close();
      })).subscribe(result => {
        if (result != undefined) {
          this.searchTableData = result;
        }
      });
    }
  }

  getPercentage(torrent: Torrent) {
    return /^[0-9]{1,3}/.exec(torrent.done)?.[0] ?? 0;
  }

  addTorrent(magnet: string): void {
    const dialogRef = this.dialog.open(LoadingComponent);
    this.torrentService.addTorrent(magnet).pipe(finalize(() => dialogRef.close()))
      .subscribe(() => this.getTorrentData());
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
