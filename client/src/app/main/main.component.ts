import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { zip } from 'rxjs';
import { InviteCodeComponent } from '../invite-code/invite-code.component';
import { LoadingComponent } from '../loading/loading.component';
import { User } from '../models/user.interface';
import { PasswordPromptComponent } from '../password-prompt/password-prompt.component';
import { ServerInfoComponent } from '../server-info/server-info.component';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';

const PING_INT = 5000;

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent {
  currentUser?: User;
  userTableData: User[] = [];
  pingInt?: any;

  isLoggedIn: boolean = false

  constructor(private userService: UserService, private certificateService: CertificateService, private dialog: MatDialog) {
    userService.isLoggedIn().subscribe(result => {
      this.isLoggedIn = result;
      if (this.isLoggedIn) {
        this.getTableData();
      }
    });

    userService.getCurrentUser().subscribe(user => this.currentUser = user);
  }

  getOpenVpnLink(): string {
    if (/Android/.test(navigator.userAgent)) {
      return "https://play.google.com/store/apps/details?id=net.openvpn.openvpn";
    } else if(/iPhone|iPad/.test(navigator.userAgent)) {
      return "https://apps.apple.com/us/app/openvpn-connect/id590379981";
    } else {
      return "https://swupdate.openvpn.org/community/releases/OpenVPN-2.5.5-I602-amd64.msi";
    }
  }

  getCurrentUser(): void {
    this.userService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      this.getTableData();
    });
  }

  getTableData(): void {
    this.userService.getUsers().subscribe(users => {
      this.certificateService.getCertificates().subscribe(certificates => {
        if (certificates) {
          users.forEach(user => {
            user.certificates = certificates.filter(certificate => certificate.username === user.username);
            if (user.username === this.currentUser?.username) {
              this.currentUser.certificates = user.certificates;
            }
          });
        }
        this.userTableData = users;
        setTimeout(() => this.getTableData(), PING_INT);
      })
    });
  }

  identify(_: any, item: User) {
    return item.username;
  }

  generateInviteLink() {
    this.dialog.open(InviteCodeComponent);
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
      var dialogRef = this.dialog.open(LoadingComponent);
      this.userService.getSmb().subscribe(() => dialogRef.close());
    }
  }

  clearCertificates(user: User | undefined) {
    if (user) {
      var dialogRef = this.dialog.open(LoadingComponent);
      zip(user.certificates.map(certificate => this.certificateService.deleteCertificate(certificate.id))).subscribe(() => {
        this.getTableData();
        dialogRef.close();
      });
    }
  }

  createCertificate() {
    this.dialog.open(PasswordPromptComponent).afterClosed().subscribe(password => {
      if (password && this.currentUser?.username) {
        var dialogRef = this.dialog.open(LoadingComponent);
        this.certificateService.createCertificate(password).subscribe(() => {
          this.getTableData();
          dialogRef.close();
        });
      }
    });
  }

  getCertificate() {
    this.certificateService.getCertificate();
  }

  deleteUser(user: User) {
    if (this.currentUser?.username === user.username || this.currentUser?.isAdmin) {
      var dialogRef = this.dialog.open(LoadingComponent);
      this.userService.deleteUser(user.username).subscribe(() => {
        this.getTableData();
        dialogRef.close();
      });
    }
  }

  promoteUser(user: User) {
    if (!user.isAdmin && this.currentUser?.isAdmin) {
      this.userService.promoteUser(user.username).subscribe(() => this.getTableData());
    }
  }

  logout(): void {
    if (this.userService.isLoggedIn()) {
      this.userService.logout();
    }
  }
}
