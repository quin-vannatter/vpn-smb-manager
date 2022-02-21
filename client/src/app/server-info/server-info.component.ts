import { Component, ElementRef, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { User } from '../models/user.interface';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-server-info',
  templateUrl: './server-info.component.html',
  styleUrls: ['./server-info.component.css']
})
export class ServerInfoComponent extends AppComponent {

  ipAddress?: string;
  folderPath?: string;
  username?: string;
  password?: string;

  constructor(private dialogRef: MatDialogRef<ServerInfoComponent>, @Inject(MAT_DIALOG_DATA) data: User) {
    super();
    this.ipAddress = "10.7.0.1";
    this.folderPath = `/share/users/${data.username}`;
    this.username = data.username;
    this.password = data.smbPassword;
  }

  close(): void {
    this.dialogRef.close();
  }
}
