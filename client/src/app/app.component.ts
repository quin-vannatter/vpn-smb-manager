import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  selectValue(elementRef: EventTarget | null, value?: string): void {
    if (elementRef) {
      let element = (<HTMLInputElement><unknown>elementRef);
      if (value) {
        element.value = value;
      }
      element.focus();
      element.select();
    }
  }
  
  getOpenVpnLink(): string {
    if (/Android/.test(navigator.userAgent)) {
      return "https://play.google.com/store/apps/details?id=net.openvpn.openvpn";
    } else if(/iPhone|iPad/.test(navigator.userAgent)) {
      return "https://apps.apple.com/us/app/openvpn-connect/id590379981";
    } else {
      return "https://swupdate.openvpn.org/community/releases/OpenVPN-2.5.5-I602-amd64.msi";
    }
  }
}