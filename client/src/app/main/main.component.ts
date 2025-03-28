import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { first, zip } from 'rxjs';
import { AppComponent } from '../app.component';
import { InviteCodeComponent } from '../invite-code/invite-code.component';
import { LoadingComponent } from '../loading/loading.component';
import { User } from '../models/user.interface';
import { ServerInfoComponent } from '../server-info/server-info.component';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';
import { CertificatesComponent } from '../certificates/certificates.component';

export const PING_INT = 5000;

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent extends AppComponent {
  currentUser?: User;
  userTableData: User[] = [];
  guestCount: number = 0;

  isLoggedIn: boolean = false;
  timeout?: NodeJS.Timeout;
  userScripts: any[] = [];

  constructor(private userService: UserService, private certificateService: CertificateService, private dialog: MatDialog) {
    super();
    userService.isLoggedIn().pipe(first()).subscribe(result => {
      this.isLoggedIn = result;
      if (this.isLoggedIn) {
        this.getTableData();
      }
    });
    userService.getCurrentUser().pipe(first(user => user != undefined)).subscribe(user => this.currentUser = user);
  }

  getCurrentUser(): void {
    this.userService.getCurrentUser().pipe(first(user => user != undefined)).subscribe(user => {
      this.currentUser = user;
      this.getTableData();
    });
  }

  getTableData(): void {
    this.userService.getUsers().pipe(first()).subscribe(result => {
      var users = result.resolvedUsers;
      this.guestCount = result.guestCount;
      this.userTableData = users;
      if (this.timeout != undefined) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => this.getTableData(), PING_INT);
    });
  }

  identify(_: any, item: User) {
    return item.username;
  }

  generateInviteLink(isGuest: boolean) {
    this.dialog.open(InviteCodeComponent, {
      data: { isGuest }
    });
  }

  openCertificatesDialog() {
    this.dialog.open(CertificatesComponent);
  }

  getServerLink() {
    const username = this.currentUser?.username;
    return `smb://${username}:${this.currentUser?.smbPassword}@10.8.0.1/share/users/${username}`;
  }

  mapNetworkDrive() {
    if(this.certificateService.isMobile()) {
      this.dialog.open(ServerInfoComponent, {
        data: this.currentUser
      });
    } else {
      const dialogRef = this.dialog.open(LoadingComponent);
      this.userService.getSmb().pipe(first()).subscribe(() => dialogRef.close());
    }
  }

  deleteUser(user: User) {
    if (this.currentUser?.username === user.username || this.currentUser?.isAdmin) {
      var dialogRef = this.dialog.open(LoadingComponent);
      this.userService.deleteUser(user.username).pipe(first()).subscribe(() => {
        this.getTableData();
        dialogRef.close();
      });
    }
  }

  promoteUser(user: User) {
    if (!user.isAdmin && this.currentUser?.isAdmin) {
      this.userService.promoteUser(user.username).pipe(first()).subscribe(() => this.getTableData());
    }
  }

  logout(): void {
    if (this.userService.isLoggedIn()) {
      this.userService.logout();
    }
  }
}
