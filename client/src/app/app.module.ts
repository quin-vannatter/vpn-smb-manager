import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatMenuModule } from '@angular/material/menu';
import { MatTable, MatTableModule } from '@angular/material/table';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button'; 
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService } from './services/user.service';
import { InviteCodeComponent } from './invite-code/invite-code.component';
import { LoginComponent } from './login/login.component';
import { MainComponent } from './main/main.component';
import { CertificateService } from './services/certificate.service';
import { PasswordPromptComponent } from './password-prompt/password-prompt.component';
import { LoadingComponent } from './loading/loading.component';
import { ServerInfoComponent } from './server-info/server-info.component';
import { CertificatesComponent } from './certificates/certificates.component';

@NgModule({
  declarations: [
    AppComponent,
    InviteCodeComponent,
    LoginComponent,
    MainComponent,
    CertificatesComponent,
    PasswordPromptComponent,
    LoadingComponent,
    ServerInfoComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,

    MatTableModule,
    MatMenuModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  providers: [UserService, CertificateService],
  bootstrap: [AppComponent]
})
export class AppModule { }
