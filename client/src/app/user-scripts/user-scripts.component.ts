import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, filter, first, map } from 'rxjs';
import { AppComponent } from '../app.component';
import { User } from '../models/user.interface';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-user-scripts',
  templateUrl: './user-scripts.component.html',
  styleUrls: ['./user-scripts.component.css']
})
export class UserScriptsComponent extends AppComponent {
  currentUser?: User;

  isLoggedIn: boolean = false;

  scriptIndex: number = 0;
  displayIndex: number = 0;

  userScripts: any[] = [];

  tableData: BehaviorSubject<string[][]> = new BehaviorSubject<string[][]>([[]]);

  constructor(private userService: UserService, router: Router) {
    super();
    userService.isLoggedIn().pipe(first()).subscribe(result => {
      this.isLoggedIn = result;
      if (this.isLoggedIn) {
        userService.getUserScripts().pipe(first()).subscribe(result => {
          if (result.length == 0) {
            router.navigateByUrl('/');
          } else {
            this.userScripts = result;
            this.getCurrentDisplay();
          }
        });
      }
    });
    userService.getCurrentUser().pipe(first(user => user != undefined)).subscribe(user => this.currentUser = user);
  }

  getDataSource(): Observable<string[][]> {
    return this.tableData.asObservable().pipe(filter(source => source.length > 1), map(source => source.slice(1)));
  }

  getDataHeaders(): Observable<string[]> {
    return this.tableData.asObservable().pipe(filter(source => source.length > 1), map(source => source[0]));
  }

  getCurrentDisplay() {
    const currentScript = this.userScripts[this.scriptIndex];
    let subscription = this.userService.getDisplay(currentScript.id, this.displayIndex).subscribe(result => {
      this.tableData.next(result);
      subscription.unsubscribe();
    });
  }

}
