import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html'
})
export class LoadingComponent {

  constructor(dialogRef: MatDialogRef<LoadingComponent>) {
    dialogRef.disableClose = true;
  }
}
