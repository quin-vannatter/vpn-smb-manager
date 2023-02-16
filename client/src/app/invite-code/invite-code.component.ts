import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppComponent } from '../app.component';
import { LoadingComponent } from '../loading/loading.component';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-invite-code',
  templateUrl: './invite-code.component.html',
  styleUrls: ['./invite-code.component.css']
})
export class InviteCodeComponent extends AppComponent implements OnInit {

  inviteLink?: string;
  @ViewChild("inviteCode", { static: false }) inviteCodeElement?: ElementRef;

  constructor(private userService: UserService, private dialogRef: MatDialogRef<InviteCodeComponent>, @Inject(MAT_DIALOG_DATA) private data: { isGuest: boolean }, private dialog: MatDialog) {
    super();
  }

  ngOnInit(): void {
    let dialogRef: MatDialogRef<LoadingComponent, any>;
    if (this.data.isGuest) {
      dialogRef = this.dialog.open(LoadingComponent);
    }
    this.userService.invite(this.data.isGuest).subscribe(inviteLink => {
      if (dialogRef != undefined)
      {
        dialogRef.close();
      }
      this.inviteLink = inviteLink;
      this.selectValue((<EventTarget><unknown>this.inviteCodeElement?.nativeElement), inviteLink);
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
