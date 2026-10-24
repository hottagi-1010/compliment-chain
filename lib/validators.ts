import { z } from "zod";

const employeeNo = z
  .string()
  .trim()
  .min(1, "사번을 입력해 주세요.")
  .max(30, "사번이 너무 깁니다.")
  .regex(/^[A-Za-z0-9-]+$/, "사번은 영문, 숫자, 하이픈만 사용할 수 있습니다.");

const password = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(72, "비밀번호가 너무 깁니다.");

export const signupSchema = z
  .object({
    employeeNo,
    name: z.string().trim().min(1, "이름을 입력해 주세요.").max(50, "이름이 너무 깁니다."),
    email: z.string().trim().toLowerCase().pipe(z.email("이메일 형식이 올바르지 않습니다.")),
    password,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export const loginSchema = z.object({
  employeeNo,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const passwordReportSchema = z.object({
  employeeNo,
  email: z.string().trim().toLowerCase().pipe(z.email("이메일 형식이 올바르지 않습니다.")),
});

export const praiseSchema = z.object({
  recipientIds: z
    .array(z.uuid())
    .min(1, "받는 사람을 1명 이상 선택해 주세요.")
    .max(20, "받는 사람은 최대 20명까지 선택할 수 있습니다."),
  categoryId: z.coerce.number().int().positive("카테고리를 선택해 주세요."),
  content: z
    .string()
    .trim()
    .min(1, "칭찬 내용을 입력해 주세요.")
    .max(2000, "칭찬 내용은 2,000자 이하로 입력해 주세요."),
  isAnonymous: z.boolean(),
});

export const commentSchema = z.object({
  praiseId: z.uuid(),
  content: z
    .string()
    .trim()
    .min(1, "댓글 내용을 입력해 주세요.")
    .max(1000, "댓글은 1,000자 이하로 입력해 주세요."),
});

export const uuidSchema = z.uuid();
export const roleSchema = z.enum(["user", "ops", "admin"]);

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
}

export function isAllowedDomain(email: string) {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  if (!domain) return false;
  return email.toLowerCase().endsWith(`@${domain}`);
}
