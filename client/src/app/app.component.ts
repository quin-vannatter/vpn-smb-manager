import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  selectValue(elementRef: EventTarget | null, value?: string): void {
    debugger;
    if (elementRef) {
      let element = (<HTMLInputElement><unknown>elementRef);
      if (value) {
        element.value = value;
      }
      element.focus();
      element.select();
    }
  }
}