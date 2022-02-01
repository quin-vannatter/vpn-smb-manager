import { Component, ElementRef, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-invite-code',
  templateUrl: './invite-code.component.html',
  styleUrls: ['./invite-code.component.css']
})
export class InviteCodeComponent implements OnInit {

  inviteLink?: string;

  @ViewChild("inviteCode", { static: false }) inviteCodeElement?: ElementRef;

  constructor(private userService: UserService, private dialogRef: MatDialogRef<InviteCodeComponent>) { }

  ngOnInit(): void {
    this.userService.invite().subscribe(inviteLink => {
      this.inviteLink = inviteLink;
      this.selectValue();
    })
  }

  selectValue(): void {
    if (this.inviteCodeElement) {
      let element = (<HTMLInputElement>this.inviteCodeElement.nativeElement);
      element.value = this.inviteLink || "";
      element.focus();
      element.select();
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
