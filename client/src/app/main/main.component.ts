import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CertificatesComponent } from '../certificates/certificates.component';
import { InviteCodeComponent } from '../invite-code/invite-code.component';
import { LoadingComponent } from '../loading/loading.component';
import { Certificate } from '../models/certificate.interface';
import { User } from '../models/user.interface';
import { PasswordPromptComponent } from '../password-prompt/password-prompt.component';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';

const PING_INT = 5000;

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent {
  columns: string[] = ['username', 'isConnected', 'actions'];
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
          users.forEach(user => user.certificates = certificates.filter(certificate => certificate.username === user.username));
        }
        this.userTableData = users;
      })
    })
    if(this.pingInt !== undefined) {
      clearInterval(this.pingInt);
    }
    this.pingInt = setInterval(() => this.getTableData(), PING_INT);
  }

  viewCertificates(certificates: Certificate[] | undefined) {
    if (certificates) {
      var dialogRef = this.dialog.open(CertificatesComponent, {
        width: "100%",
        data: {
          currentUser: this.currentUser,
          certificateTableData: certificates
        }
      });
      dialogRef.afterClosed().subscribe(() => {
        this.getTableData();
      })
    }
  }

  generateInviteLink() {
    this.dialog.open(InviteCodeComponent);
  }

  getCertificate() {
    if (this.currentUser?.username) {
      this.certificateService.getCertificates().subscribe(certificates => {
        if (this.currentUser?.username) {
          if (certificates?.some(certificate => !certificate.isConnected && certificate.username === this.currentUser?.username)) {
            this.certificateService.getCertificate();
          } else {
            this.dialog.open(PasswordPromptComponent).afterClosed().subscribe(password => {
              if (password && this.currentUser?.username) {
                var dialogRef = this.dialog.open(LoadingComponent)
                this.certificateService.createCertificate(password).subscribe(() => dialogRef.close());
              }
            });
          }
        }
      })
    }
  }

  hasAccess(username: string) {
    return this.currentUser?.isAdmin || this.currentUser?.username === username;
  }

  mapNetworkDrive() {
    var dialogRef = this.dialog.open(LoadingComponent)
    this.userService.getSmb().subscribe(() => dialogRef.close());
  }

  deleteUser(user: User) {
    if (this.currentUser?.username === user.username || this.currentUser?.isAdmin) {
      this.userService.deleteUser(user.username).subscribe(() => {
        this.getTableData();
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
