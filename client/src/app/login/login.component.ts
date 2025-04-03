import { Component, HostListener } from '@angular/core';
import { AbstractControl, FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { AppComponent } from '../app.component';
import { LoadingComponent } from '../loading/loading.component';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent extends AppComponent {

  username = new FormControl();
  password = new FormControl();
  passwordConfirm = new FormControl("", (control: AbstractControl): { [key: string]: boolean } | null => {
    if (control.value !== undefined && this.password.value !== control.value) {
      return { passwordsMatch: true };
    }
    return null;
  });
  inviteCode?: string | null;
  inviteType?: string | null;

  constructor(private userService: UserService, route: ActivatedRoute, private router: Router, certificateService: CertificateService, private dialog: MatDialog) {
    super();
    route.params.subscribe(params => {
      this.inviteCode = params["inviteCode"];
      this.inviteType = params["inviteType"];

      if (this.inviteType === "guest" && this.inviteCode != null) {
        certificateService.getGuestCertificateById(this.inviteCode).subscribe(() => window.location.href = this.getOpenVpnLink());
        this.inviteCode = undefined;
      }
    });
  }

  isFormValid(): boolean {
    return this.password.valid && this.username.valid && (!this.inviteCode || this.passwordConfirm.valid);
  }

  @HostListener("document:keypress", ["$event"])
  login(event?: KeyboardEvent): void {
    if (this.isFormValid() && (event === undefined || event.key === "Enter")) {
      var dialog = this.dialog.open(LoadingComponent);
      var userArgs: [string, string] = [this.username.value, this.password.value];
      if (!this.inviteCode) {
        this.userService.login(...userArgs).subscribe(() => {
          dialog.close();
          this.router.navigate(["home"]);
        });
      } else {
        this.userService.createUser(this.inviteCode, ...userArgs).subscribe(() => {
          this.userService.login(...userArgs).subscribe(() => {
            dialog.close();
            this.router.navigate(["home"]);
          });
        })
      }
    }
  }
}
