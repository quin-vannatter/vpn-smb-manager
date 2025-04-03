import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainComponent } from './main/main.component';
import { LoginComponent } from './login/login.component';
import { TorrentsComponent } from './torrents/torrents.component';

const routes: Routes = [
  { path: "login/:inviteCode/:inviteType", component: LoginComponent },
  { path: "login", component: LoginComponent },
  { path: "home", component: MainComponent },
  { path: "torrents", component: TorrentsComponent },
  { path: "**", redirectTo: "home" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
