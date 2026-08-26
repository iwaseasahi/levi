import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  ProvisioningAuthorizationError,
  ProvisioningInputError,
  type ProvisionChurchResult,
} from "./provision-church";
import {
  parseProvisioningInput,
  type ProvisioningFieldErrors,
} from "./provisioning-input";

export type ProvisionChurchFormState =
  | { status: "idle" }
  | {
      fieldErrors: ProvisioningFieldErrors;
      message: string;
      status: "validation-error";
    }
  | { message: string; status: "not-authorized" }
  | { message: string; status: "server-error" }
  | {
      churchName: string;
      email: string;
      message: string;
      status: "success";
    };

export const initialProvisionChurchFormState: ProvisionChurchFormState = {
  status: "idle",
};

interface ProvisionChurchControllerDependencies {
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  provisionChurch(
    operatorUserId: string,
    input: {
      accountName: unknown;
      churchName: unknown;
      email: unknown;
    },
  ): Promise<ProvisionChurchResult>;
  recordEvent(event: {
    actorAdminUserId?: string;
    outcome: "denied" | "failed" | "succeeded" | "validation_failed";
    requestId?: string;
    targetChurchId?: string;
  }): void;
}

export function createProvisionChurchController(
  dependencies: ProvisionChurchControllerDependencies,
) {
  return async function handleProvisionChurch(
    headers: Headers,
    rawInput: {
      accountName: unknown;
      churchName: unknown;
      email: unknown;
    },
    requestId?: string,
  ): Promise<ProvisionChurchFormState> {
    const access = await dependencies.getOperatorAccess(headers);
    if (access.status !== "authorized") {
      dependencies.recordEvent({
        ...(access.status === "forbidden"
          ? { actorAdminUserId: access.adminUserId }
          : {}),
        outcome: "denied",
        ...(requestId ? { requestId } : {}),
      });
      return {
        message: "この操作を実行できません。再度ログインしてください。",
        status: "not-authorized",
      };
    }

    const parsed = parseProvisioningInput(rawInput);
    if (!parsed.success) {
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "validation_failed",
        ...(requestId ? { requestId } : {}),
      });
      return {
        fieldErrors: parsed.errors,
        message: "入力内容を確認してください。",
        status: "validation-error",
      };
    }

    try {
      const result = await dependencies.provisionChurch(
        access.adminUserId,
        parsed.data,
      );
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "succeeded",
        ...(requestId ? { requestId } : {}),
        targetChurchId: result.churchId,
      });
      return {
        churchName: result.churchName,
        email: result.email,
        message: "教会利用者へ招待メールを送信しました。",
        status: "success",
      };
    } catch (error) {
      if (error instanceof ProvisioningInputError) {
        return {
          fieldErrors: error.fieldErrors,
          message: "入力内容を確認してください。",
          status: "validation-error",
        };
      }

      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome:
          error instanceof ProvisioningAuthorizationError ? "denied" : "failed",
        ...(requestId ? { requestId } : {}),
      });
      return error instanceof ProvisioningAuthorizationError
        ? {
            message: "この操作を実行できません。再度ログインしてください。",
            status: "not-authorized",
          }
        : {
            message:
              "作成できませんでした。入力内容を確認して、もう一度お試しください。",
            status: "server-error",
          };
    }
  };
}
