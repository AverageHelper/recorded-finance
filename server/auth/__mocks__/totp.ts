import type { TOTPToken } from "../../database/schemas";
import type {
	base32Decode as _base32Decode,
	base32Encode as _base32Encode,
	generateTOTP as _generateTOTP,
	verifyTOTP as _verifyTOTP,
	generateTOTPSecretURI as _generateTOTPSecretURI,
	generateSecret as _generateSecret,
	TOTPSecretUri,
} from "../totp";
import { beforeEach, vi } from "vitest";
import { DEFAULT_MOCK_SECURE_TOKEN } from "./generators";

export const base32Decode = vi.fn<
	Parameters<typeof _base32Decode>,
	ReturnType<typeof _base32Decode>
>();

export const base32Encode = vi.fn<
	Parameters<typeof _base32Encode>,
	ReturnType<typeof _base32Encode>
>();

export const DEFAULT_MOCK_TOTP_CODE = "000000" as TOTPToken;

export const generateTOTP = vi.fn<
	Parameters<typeof _generateTOTP>,
	ReturnType<typeof _generateTOTP>
>();

export const verifyTOTP = vi.fn<Parameters<typeof _verifyTOTP>, ReturnType<typeof _verifyTOTP>>();

export const DEFAULT_MOCK_OTP_SECUET_URI = "otpauth://totp/test:test" as TOTPSecretUri;

export const generateTOTPSecretURI = vi.fn<
	Parameters<typeof _generateTOTPSecretURI>,
	ReturnType<typeof _generateTOTPSecretURI>
>();

export const generateSecret = vi.fn<
	Parameters<typeof _generateSecret>,
	ReturnType<typeof _generateSecret>
>();

beforeEach(() => {
	base32Decode.mockReturnValue(new ArrayBuffer(0));
	base32Encode.mockReturnValue("test" as TOTPSecretUri);
	generateTOTP.mockReturnValue(DEFAULT_MOCK_TOTP_CODE);
	verifyTOTP.mockImplementation(token => token === DEFAULT_MOCK_TOTP_CODE);
	generateTOTPSecretURI.mockReturnValue(DEFAULT_MOCK_OTP_SECUET_URI);
	generateSecret.mockReturnValue(DEFAULT_MOCK_SECURE_TOKEN as string as TOTPSecretUri);
});
