export type Role = "user" | "ops" | "admin";

export type Profile = {
  id: string;
  employee_no: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
};

export type PersonRef = {
  id: string;
  name: string;
  is_active: boolean;
};

// praises_public 뷰의 한 행. 익명 글이면 author_* 는 null
export type PraiseCard = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  author_is_active: boolean | null;
  is_anonymous: boolean;
  category_id: number | null;
  category_name: string | null;
  content: string;
  created_at: string;
  is_mine: boolean;
  recipients: PersonRef[];
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
};

export type Category = {
  id: number;
  name: string;
};

export type Comment = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: { name: string; is_active: boolean } | null;
};

export type RequestStatus = "pending" | "done";

export type MyPraise = {
  id: string;
  content: string;
  is_anonymous: boolean;
  is_hidden: boolean;
  category_name: string | null;
  created_at: string;
  recipients: PersonRef[];
  request_status: RequestStatus | null;
};

export type ActionState = {
  error?: string;
  message?: string;
};
