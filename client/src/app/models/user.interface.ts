import { Certificate } from "./certificate.interface";

export interface User {
    username: string;
    isAdmin: boolean;
    connected: boolean;
    smbPassword: string;
}