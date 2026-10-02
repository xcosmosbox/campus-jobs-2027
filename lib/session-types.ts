export type SessionInfo={scope:string;mode:'guest'|'account';hasRecovery:boolean;account:{email:string;connected:boolean;hasWorkspace:boolean}|null;loginProvider?:'chatgpt'|'none';signInPath:string|null;signOutPath:string|null};
export type SessionAction='recover'|'recovery'|'link_account'|'open_account'|'new_guest';
