import { Component, ElementRef, EventEmitter, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-password-prompt',
  templateUrl: './password-prompt.component.html',
  styleUrls: ['./password-prompt.component.css']
})
export class PasswordPromptComponent {

  passwordInput?: string;

  @ViewChild("inviteCode", { static: false }) inviteCodeElement?: ElementRef;

  constructor(private dialogRef: MatDialogRef<PasswordPromptComponent>) { }

  close(): void {
    this.dialogRef.close();
  }

  submitPassword() {
    if (this.passwordInput) {
      this.dialogRef.close(this.passwordInput);
    }
  }
}
