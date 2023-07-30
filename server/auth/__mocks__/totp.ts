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
import { DEFAULT_MOCK_SECURE_TOKEN } from "./generators";
import { jest } from "@jest/globals";

export const base32Decode = jest.fn<typeof _base32Decode>();

export const base32Encode = jest.fn<typeof _base32Encode>();

export const DEFAULT_MOCK_TOTP_CODE = "000000" as TOTPToken;

export const generateTOTP = jest.fn<typeof _generateTOTP>();

export const verifyTOTP = jest.fn<typeof _verifyTOTP>();

export const DEFAULT_MOCK_OTP_SECUET_URI = "otpauth://totp/test:test" as TOTPSecretUri;

export const generateTOTPSecretURI = jest.fn<typeof _generateTOTPSecretURI>();

export const generateSecret = jest.fn<typeof _generateSecret>();

beforeEach(() => {
	base32Decode.mockReturnValue(new ArrayBuffer(0));
	base32Encode.mockReturnValue("test" as TOTPSecretUri);
	generateTOTP.mockReturnValue(DEFAULT_MOCK_TOTP_CODE);
	verifyTOTP.mockImplementation(token => token === DEFAULT_MOCK_TOTP_CODE);
	generateTOTPSecretURI.mockReturnValue(DEFAULT_MOCK_OTP_SECUET_URI);
	generateSecret.mockReturnValue(DEFAULT_MOCK_SECURE_TOKEN as string as TOTPSecretUri);
});
