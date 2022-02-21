import { Certificate } from "./certificate.interface";

export interface User {
    username: string;
    isAdmin: boolean;
    isConnected: boolean;
    certificates: Certificate[];
    smbPassword: string;
}