export interface RegisterDto {
  username: string;
  email: string;
  fullName: string;
  password: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface UserResponseDto {
  username: string;
  fullName: string;
  email: string;
  role: string;
}
