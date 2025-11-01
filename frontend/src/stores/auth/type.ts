export interface UserState {
  name: string;
  email: string;
}

export interface UserAction {
  login: (data: UserState) => void;
  logout: () => void;
}
