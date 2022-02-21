import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AppComponent } from '../app.component';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-invite-code',
  templateUrl: './invite-code.component.html',
  styleUrls: ['./invite-code.component.css']
})
export class InviteCodeComponent extends AppComponent implements OnInit {

  inviteLink?: string;

  @ViewChild("inviteCode", { static: false }) inviteCodeElement?: ElementRef;

  constructor(private userService: UserService, private dialogRef: MatDialogRef<InviteCodeComponent>) {
    super();
  }

  ngOnInit(): void {
    this.userService.invite().subscribe(inviteLink => {
      this.inviteLink = inviteLink;
      this.selectValue((<EventTarget><unknown>this.inviteCodeElement?.nativeElement), inviteLink);
    })
  }

  close(): void {
    this.dialogRef.close();
  }
}
