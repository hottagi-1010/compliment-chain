// DB 함수가 던지는 코드를 사용자용 문장으로 바꾼다. 내부 구조는 노출하지 않는다.
const MESSAGES: Record<string, string> = {
  NOT_ALLOWED: "권한이 없습니다.",
  INVALID_CONTENT: "칭찬 내용은 1~2,000자로 입력해 주세요.",
  RECIPIENT_REQUIRED: "받는 사람을 1명 이상 선택해 주세요.",
  TOO_MANY_RECIPIENTS: "받는 사람은 최대 20명까지 선택할 수 있습니다.",
  SELF_RECIPIENT: "자기 자신은 받는 사람으로 지정할 수 없습니다.",
  INVALID_RECIPIENT: "선택한 받는 사람을 찾을 수 없습니다. 다시 선택해 주세요.",
  INVALID_CATEGORY: "카테고리를 선택해 주세요.",
  ALREADY_REQUESTED: "이미 삭제 요청이 접수된 글입니다.",
  ALREADY_PROCESSED: "이미 처리된 요청입니다.",
  CANNOT_CHANGE_SELF: "본인 계정은 변경할 수 없습니다.",
  INVALID_ROLE: "올바르지 않은 역할입니다.",
  NOT_FOUND: "대상을 찾을 수 없습니다.",
  EMAIL_DOMAIN_NOT_ALLOWED: "사내 이메일로만 가입할 수 있습니다.",
};

export const GENERIC_ERROR = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function toUserMessage(error: { message?: string } | null | undefined) {
  if (!error?.message) return GENERIC_ERROR;
  const code = Object.keys(MESSAGES).find((key) => error.message!.includes(key));
  return code ? MESSAGES[code] : GENERIC_ERROR;
}
