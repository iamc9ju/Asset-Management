import type { AddressInfo } from "node:net";
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { IsEmail, IsString, MinLength } from "class-validator";
import { APP_ERROR_CODE } from "../../errors/app-error-code";
import { AppError } from "../../errors/app-error";
import type { ErrorResponseEnvelope } from "../../errors/error-response.types";
import { requestIdMiddleware } from "../request-id/request-id.middleware";
import { createValidationPipe } from "../validation/validation.pipe";
import { GlobalExceptionFilter } from "./global-exception.filter";

class ValidationRequestDto {
  @IsEmail({}, { message: "email must be a valid email address" })
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}

@Controller("test-errors")
class ErrorTestController {
  @Post("validation")
  validate(@Body() body: ValidationRequestDto): { ok: true } {
    void body;
    return { ok: true };
  }

  @Get("conflict")
  conflict(): never {
    throw new AppError(APP_ERROR_CODE.CONFLICT, {
      details: {
        asset_id: "asset-123",
        password: "must-not-be-returned",
      },
    });
  }

  @Get("unexpected")
  unexpected(): never {
    throw new Error("SQL failure containing secret=must-not-be-returned");
  }
}

describe("GlobalExceptionFilter integration", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorTestController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(requestIdMiddleware);
    app.useGlobalPipes(createValidationPipe());
    app.setGlobalPrefix("api/v1");

    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function readErrorResponse(
    path: string,
    init?: RequestInit,
  ): Promise<{ response: Response; body: ErrorResponseEnvelope }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const body = (await response.json()) as ErrorResponseEnvelope;
    return { response, body };
  }

  function expectRequestId(
    response: Response,
    body: ErrorResponseEnvelope,
  ): void {
    expect(body.error.request_id).toEqual(expect.any(String));
    expect(body.error.request_id).toBe(response.headers.get("x-request-id"));
  }

  it("returns structured field errors for invalid input", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/test-errors/validation",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "invalid" }),
      },
    );

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(APP_ERROR_CODE.VALIDATION_FAILED);
    expect(body.error.details).toEqual({
      fields: [
        {
          field: "email",
          messages: ["email must be a valid email address"],
        },
        {
          field: "name",
          messages: [
            "name must be a string",
            "name must be longer than or equal to 2 characters",
          ],
        },
      ],
    });
    expectRequestId(response, body);
  });

  it("maps unknown routes to a safe 404 envelope", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/does-not-exist",
    );

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.RESOURCE_NOT_FOUND,
      message: "The requested resource was not found.",
      details: {},
    });
    expectRequestId(response, body);
  });

  it("maps AppError to 409 and removes sensitive details", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/test-errors/conflict",
    );

    expect(response.status).toBe(409);
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.CONFLICT,
      details: { asset_id: "asset-123" },
    });
    expect(JSON.stringify(body)).not.toContain("must-not-be-returned");
    expect(JSON.stringify(body)).not.toContain("password");
    expectRequestId(response, body);
  });

  it("hides internal error messages and stack traces for 500 errors", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/test-errors/unexpected",
    );

    expect(response.status).toBe(500);
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.INTERNAL_ERROR,
      message: "An unexpected error occurred.",
      details: {},
    });
    expect(JSON.stringify(body)).not.toContain("SQL failure");
    expect(JSON.stringify(body)).not.toContain("must-not-be-returned");
    expect(JSON.stringify(body)).not.toContain("stack");
    expectRequestId(response, body);
  });
});
