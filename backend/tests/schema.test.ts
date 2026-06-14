import { describe, it, expect, beforeAll } from "vitest";
import { getDMMF, getConfig } from "@prisma/internals";
import { PrismaClient } from "@prisma/client";
import * as path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
const schemaContent = readFileSync(schemaPath, "utf8");

interface DmmfModel {
  name: string;
  dbName?: string | null;
  fields: DmmfField[];
  primaryKey?: { fields: string[] } | null;
  uniqueFields: string[][];
  uniqueIndexes: { fields: string[] }[];
}

interface DmmfField {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isId: boolean;
  default?: unknown;
  hasDefaultValue: boolean;
  relationName?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
  isNullable?: boolean;
  documentation?: string;
}

interface DmmfEnum {
  name: string;
  values: DmmfEnumValue[];
}

interface DmmfEnumValue {
  name: string;
  dbName: string | null;
}

let dmmfModels: Map<string, DmmfModel>;
let dmmfEnums: Map<string, DmmfEnum>;
let prisma: PrismaClient;

beforeAll(async () => {
  const dmmf = await getDMMF({ datamodelPath: schemaPath });
  dmmfModels = new Map(dmmf.datamodel.models.map((m) => [m.name, m as unknown as DmmfModel]));
  dmmfEnums = new Map(dmmf.datamodel.enums.map((e) => [e.name, e as unknown as DmmfEnum]));
  prisma = new PrismaClient();
});

function getModel(name: string): DmmfModel {
  const m = dmmfModels.get(name);
  if (!m) throw new Error(`Model "${name}" not found in DMMF`);
  return m;
}

function getField(model: DmmfModel, name: string): DmmfField {
  const f = model.fields.find((f) => f.name === name);
  if (!f) throw new Error(`Field "${name}" not found on model "${model.name}"`);
  return f;
}

describe("Datasource & Generator", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  it("should use postgresql as the database provider", async () => {
    const config = await getConfig({ datamodel: schemaContent });
    expect(config.datasources).toHaveLength(1);
    expect(config.datasources[0].provider).toBe("postgresql");
    expect(config.datasources[0].url).toMatchObject({ fromEnvVar: "DATABASE_URL" });
  });

  it("should generate prisma-client-js", async () => {
    const config = await getConfig({ datamodel: schemaContent });
    expect(config.generators).toHaveLength(1);
    expect(config.generators[0].provider.value).toBe("prisma-client-js");
  });
});

describe("Enum: Role", () => {
  it("should exist with two values", () => {
    const role = dmmfEnums.get("Role");
    expect(role).toBeDefined();
    expect(role!.values.map((v) => v.name)).toEqual(["USER", "ADMIN"]);
  });
});

describe("Model: User", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("User"); });

  it("should have all scalar fields with correct types", () => {
    const scalars: Record<string, string> = {
      id: "Int", username: "String", email: "String", fullName: "String",
      hashedPassword: "String", isActive: "Boolean", isVerified: "Boolean",
      role: "Role", createdAt: "DateTime",
    };
    for (const [name, type] of Object.entries(scalars)) {
      const f = getField(model, name);
      expect(f.kind).toBe(name === "role" ? "enum" : "scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should mark id as autoincrement primary key", () => {
    const id = getField(model, "id");
    expect(id.isId).toBe(true);
    expect(id.hasDefaultValue).toBe(true);
  });

  it("should enforce uniqueness on username and email", () => {
    expect(getField(model, "username").isUnique).toBe(true);
    expect(getField(model, "email").isUnique).toBe(true);
  });

  it("should default isActive to true, isVerified to false, and role to USER", () => {
    expect(getField(model, "isActive").hasDefaultValue).toBe(true);
    expect(getField(model, "isVerified").hasDefaultValue).toBe(true);
    const role = getField(model, "role");
    expect(role.hasDefaultValue).toBe(true);
    expect(role.type).toBe("Role");
  });

  it("should default createdAt to now()", () => {
    expect(getField(model, "createdAt").hasDefaultValue).toBe(true);
  });

  it("should have required fields marked as required", () => {
    ["username", "email", "fullName", "hashedPassword"].forEach((name) => {
      expect(getField(model, name).isRequired).toBe(true);
    });
  });

  it("should have all relation fields (one-to-many)", () => {
    const relations = ["activityLogs", "chatLogs", "documents", "escalations", "conversations", "passwordResetTokens", "emailVerificationTokens"];
    for (const name of relations) {
      const f = getField(model, name);
      expect(f.kind).toBe("object");
      expect(f.isList).toBe(true);
    }
  });

  it("should have no unknown fields", () => {
    const expected = new Set([
      "id", "username", "email", "fullName", "hashedPassword",
      "isActive", "isVerified", "role", "createdAt",
      "activityLogs", "chatLogs", "documents", "escalations",
      "conversations", "passwordResetTokens", "emailVerificationTokens",
    ]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

describe("Model: PasswordResetToken", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("PasswordResetToken"); });

  it("should have all scalar fields", () => {
    const fields = { id: "Int", userId: "Int", token: "String", expiresAt: "DateTime", usedAt: "DateTime" };
    for (const [name, type] of Object.entries(fields)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should enforce uniqueness on token", () => {
    expect(getField(model, "token").isUnique).toBe(true);
  });

  it("should allow usedAt to be nullable", () => {
    expect(getField(model, "usedAt").isRequired).toBe(false);
  });

  it("should relate to User via userId with onDelete Cascade", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(new Set(["id", "userId", "user", "token", "expiresAt", "usedAt"]));
  });
});

describe("Model: EmailVerificationToken", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("EmailVerificationToken"); });

  it("should have all scalar fields", () => {
    const fields = { id: "Int", userId: "Int", token: "String", expiresAt: "DateTime" };
    for (const [name, type] of Object.entries(fields)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should enforce uniqueness on token", () => {
    expect(getField(model, "token").isUnique).toBe(true);
  });

  it("should relate to User via userId with onDelete Cascade", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(new Set(["id", "userId", "user", "token", "expiresAt"]));
  });
});

describe("Model: Document", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("Document"); });

  it("should have all scalar fields with correct types", () => {
    const scalars: Record<string, string> = {
      id: "Int", filename: "String", originalName: "String", mimeType: "String",
      sizeBytes: "Int", status: "String", errorMessage: "String",
      collectionName: "String", uploadedById: "Int", createdAt: "DateTime", updatedAt: "DateTime",
    };
    for (const [name, type] of Object.entries(scalars)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should default status and collectionName", () => {
    expect(getField(model, "status").hasDefaultValue).toBe(true);
    expect(getField(model, "collectionName").hasDefaultValue).toBe(true);
  });

  it("should allow errorMessage to be nullable", () => {
    expect(getField(model, "errorMessage").isRequired).toBe(false);
  });

  it("should have updatedAt as DateTime", () => {
    expect(getField(model, "updatedAt").type).toBe("DateTime");
  });

  it("should relate uploadedBy to User", () => {
    const f = getField(model, "uploadedBy");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["uploadedById"]);
  });

  it("should have no unknown fields", () => {
    const expected = new Set([
      "id", "filename", "originalName", "mimeType", "sizeBytes",
      "status", "errorMessage", "collectionName", "uploadedById",
      "uploadedBy", "createdAt", "updatedAt",
    ]);
    expect(new Set(model.fields.map((f) => f.name))).toEqual(expected);
  });
});

describe("Model: ActivityLog", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("ActivityLog"); });

  it("should have all fields with correct types", () => {
    const fields: Record<string, string> = {
      id: "Int", userId: "Int", action: "String",
      ipAddress: "String", userAgent: "String", success: "Boolean",
      metadata: "Json", createdAt: "DateTime",
    };
    for (const [name, type] of Object.entries(fields)) {
      const f = getField(model, name);
      expect(f.kind).toBe(name === "metadata" ? "scalar" : "scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should allow ipAddress, userAgent, metadata to be nullable", () => {
    expect(getField(model, "ipAddress").isRequired).toBe(false);
    expect(getField(model, "userAgent").isRequired).toBe(false);
    expect(getField(model, "metadata").isRequired).toBe(false);
  });

  it("should default success to true", () => {
    expect(getField(model, "success").hasDefaultValue).toBe(true);
  });

  it("should relate to User", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(
      new Set(["id", "userId", "user", "action", "ipAddress", "userAgent", "success", "metadata", "createdAt"])
    );
  });
});

describe("Model: ChatLog", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("ChatLog"); });

  it("should have all scalar fields with correct types", () => {
    const fields: Record<string, string> = {
      id: "Int", userId: "Int", question: "String", isAnswered: "Boolean",
      hasImage: "Boolean", imagePath: "String", createdAt: "DateTime",
    };
    for (const [name, type] of Object.entries(fields)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should allow nullable fields", () => {
    expect(getField(model, "question").isRequired).toBe(false);
    expect(getField(model, "isAnswered").isRequired).toBe(false);
    expect(getField(model, "imagePath").isRequired).toBe(false);
  });

  it("should default hasImage to false", () => {
    expect(getField(model, "hasImage").hasDefaultValue).toBe(true);
  });

  it("should relate to User", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
  });

  it("should have optional one-to-one relation to EscalationTicket", () => {
    const f = getField(model, "escalation");
    expect(f.kind).toBe("object");
    expect(f.isList).toBe(false);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(
      new Set(["id", "userId", "user", "question", "isAnswered", "hasImage", "imagePath", "createdAt", "escalation"])
    );
  });
});

describe("Model: EscalationTicket", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("EscalationTicket"); });

  it("should have all scalar fields", () => {
    const fields: Record<string, string> = {
      id: "Int", userId: "Int", question: "String", reason: "String",
      confidence: "Float", status: "String", chatLogId: "Int",
      resolvedAt: "DateTime", createdAt: "DateTime", updatedAt: "DateTime",
    };
    for (const [name, type] of Object.entries(fields)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should default reason and status", () => {
    expect(getField(model, "reason").hasDefaultValue).toBe(true);
    expect(getField(model, "status").hasDefaultValue).toBe(true);
  });

  it("should allow nullable fields", () => {
    expect(getField(model, "confidence").isRequired).toBe(false);
    expect(getField(model, "chatLogId").isRequired).toBe(false);
    expect(getField(model, "resolvedAt").isRequired).toBe(false);
  });

  it("should enforce uniqueness on chatLogId", () => {
    expect(getField(model, "chatLogId").isUnique).toBe(true);
  });

  it("should have updatedAt as DateTime", () => {
    expect(getField(model, "updatedAt").type).toBe("DateTime");
  });

  it("should relate to User and ChatLog", () => {
    expect(getField(model, "user").type).toBe("User");
    expect(getField(model, "chatLog").type).toBe("ChatLog");
    expect(getField(model, "chatLog").relationFromFields).toEqual(["chatLogId"]);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(
      new Set(["id", "userId", "user", "question", "reason", "confidence", "status",
        "chatLogId", "chatLog", "resolvedAt", "createdAt", "updatedAt"])
    );
  });
});

describe("Model: Conversation", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("Conversation"); });

  it("should have all scalar fields", () => {
    const fields: Record<string, string> = {
      id: "Int", userId: "Int", title: "String", createdAt: "DateTime", updatedAt: "DateTime",
    };
    for (const [name, type] of Object.entries(fields)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should allow title to be nullable", () => {
    expect(getField(model, "title").isRequired).toBe(false);
  });

  it("should have userId field as required", () => {
    expect(getField(model, "userId").isRequired).toBe(true);
  });

  it("should relate to User and n8n_chat_histories", () => {
    expect(getField(model, "user").type).toBe("User");
    expect(getField(model, "chatHistories").type).toBe("n8n_chat_histories");
    expect(getField(model, "chatHistories").isList).toBe(true);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(
      new Set(["id", "userId", "title", "createdAt", "updatedAt", "user", "chatHistories"])
    );
  });
});

describe("Model: n8n_chat_histories", () => {
  let model: DmmfModel;

  beforeAll(() => { model = getModel("n8n_chat_histories"); });

  it("should map to table 'n8n_chat_histories'", () => {
    expect(model.dbName).toBe("n8n_chat_histories");
  });

  it("should have id, session_id, conversationId, and message fields", () => {
    expect(getField(model, "id").isId).toBe(true);
    expect(getField(model, "id").type).toBe("Int");
    expect(getField(model, "session_id").isRequired).toBe(false);
    expect(getField(model, "session_id").type).toBe("String");
    expect(getField(model, "conversationId").type).toBe("Int");
    expect(getField(model, "conversationId").isRequired).toBe(false);
    expect(getField(model, "message").type).toBe("Json");
    expect(getField(model, "message").isRequired).toBe(true);
  });

  it("should relate to Conversation", () => {
    const f = getField(model, "conversation");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("Conversation");
    expect(f.relationFromFields).toEqual(["conversationId"]);
  });

  it("should have no unknown fields", () => {
    expect(new Set(model.fields.map((f) => f.name))).toEqual(
      new Set(["id", "session_id", "conversationId", "message", "conversation"])
    );
  });
});

describe("Schema integrity", () => {
  it("should contain exactly 7 models", () => {
    const names = Array.from(dmmfModels.keys()).sort();
    expect(names).toEqual([
      "ActivityLog", "ChatLog", "Conversation", "Document",
      "EmailVerificationToken", "EscalationTicket",
      "PasswordResetToken", "User", "n8n_chat_histories",
    ]);
  });

  it("should have exactly 1 enum (Role)", () => {
    expect(dmmfEnums.size).toBe(1);
    expect(dmmfEnums.has("Role")).toBe(true);
  });

  it("should verify every FK has a matching relation field", () => {
    const checks: [string, string, string][] = [
      ["Document", "uploadedById", "uploadedBy"],
      ["ActivityLog", "userId", "user"],
      ["ChatLog", "userId", "user"],
      ["EscalationTicket", "userId", "user"],
      ["EscalationTicket", "chatLogId", "chatLog"],
      ["PasswordResetToken", "userId", "user"],
      ["EmailVerificationToken", "userId", "user"],
      ["Conversation", "userId", "user"],
      ["n8n_chat_histories", "conversationId", "conversation"],
    ];
    for (const [modelName, fkField, relationField] of checks) {
      const model = getModel(modelName);
      expect(getField(model, fkField)).toBeDefined();
      const rel = getField(model, relationField);
      expect(rel.kind).toBe("object");
      expect(rel.relationFromFields).toBeDefined();
    }
  });
});

describe("Prisma Client generated types", () => {
  it("should expose delegate keys for every model", () => {
    const delegates = Object.keys(prisma).filter((k) => !k.startsWith("$") && !k.startsWith("_"));
    expect(delegates.sort()).toEqual([
      "activityLog", "chatLog", "conversation", "document",
      "emailVerificationToken", "escalationTicket",
      "n8n_chat_histories", "passwordResetToken", "user",
    ]);
  });

  it("should have Role enum on the client", () => {
    const role = dmmfEnums.get("Role")!;
    const names = role.values.map((v) => v.name);
    expect(names).toContain("USER");
    expect(names).toContain("ADMIN");
  });

  it("should be able to disconnect cleanly", async () => {
    await prisma.$disconnect();
  });
});
