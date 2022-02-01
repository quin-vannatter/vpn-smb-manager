import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  username = new FormControl();
  password = new FormControl();
  passwordConfirm = new FormControl("", (control: AbstractControl): { [key: string]: boolean } | null => {
    if (control.value !== undefined && this.password.value !== control.value) {
      return { passwordsMatch: true };
    }
    return null;
  });
  inviteCode?: string | null;

  constructor(private userService: UserService, route: ActivatedRoute, private router: Router) {
    route.params.subscribe(params => {
      this.inviteCode = params["inviteCode"];
    });
  }

  isFormValid(): boolean {
    return this.password.valid && this.username.valid && (!this.inviteCode || this.passwordConfirm.valid);
  }

  login(): void {
    if (this.username.valid && this.password.valid) {
      var userArgs: [string, string] = [this.username.value, btoa(this.password.value)];
      if (!this.inviteCode) {
        this.userService.login(...userArgs).subscribe(() => this.router.navigate(["home"]));
      } else {
        this.userService.createUser(this.inviteCode, ...userArgs).subscribe(() => {
          this.userService.login(...userArgs).subscribe(() => this.router.navigate(["home"]));
        })
      }
    }
  }
}
