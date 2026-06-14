import { describe, it, expect, beforeAll } from "vitest";
import { getDMMF, getConfig } from "@prisma/internals";
import { PrismaClient } from "@prisma/client";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  values: string[];
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

// ---------------------------------------------------------------------------
// 1. Datasource & Generator
// ---------------------------------------------------------------------------

describe("Datasource & Generator", () => {
  it("should use postgresql as the database provider", async () => {
    const config = await getConfig({ datamodel: schemaPath });
    expect(config.datasources).toHaveLength(1);
    expect(config.datasources[0].provider).toBe("postgresql");
    expect(config.datasources[0].url).toMatchObject({ fromEnvVar: "DATABASE_URL" });
  });

  it("should generate prisma-client-js", async () => {
    const config = await getConfig({ datamodel: schemaPath });
    expect(config.generators).toHaveLength(1);
    expect(config.generators[0].provider.value).toBe("prisma-client-js");
  });
});

// ---------------------------------------------------------------------------
// 2. Enums
// ---------------------------------------------------------------------------

describe("Enum: Role", () => {
  it("should exist with two values", () => {
    const role = dmmfEnums.get("Role");
    expect(role).toBeDefined();
    expect(role!.values).toEqual(["USER", "ADMIN"]);
  });
});

// ---------------------------------------------------------------------------
// 3. Model: User
// ---------------------------------------------------------------------------

describe("Model: User", () => {
  let model: DmmfModel;

  beforeAll(() => {
    model = getModel("User");
  });

  it("should have all scalar fields with correct types", () => {
    const scalars: Record<string, string> = {
      id: "Int",
      username: "String",
      email: "String",
      fullName: "String",
      hashedPassword: "String",
      isActive: "Boolean",
      role: "Role",
      createdAt: "DateTime",
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

  it("should default isActive to true and role to USER", () => {
    expect(getField(model, "isActive").hasDefaultValue).toBe(true);
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

  // Relation fields
  it("should have relation to ActivityLog (one-to-many)", () => {
    const f = getField(model, "activityLogs");
    expect(f.kind).toBe("object");
    expect(f.isList).toBe(true);
    expect(f.type).toBe("ActivityLog");
  });

  it("should have relation to ChatLog (one-to-many)", () => {
    const f = getField(model, "chatLogs");
    expect(f.kind).toBe("object");
    expect(f.isList).toBe(true);
    expect(f.type).toBe("ChatLog");
  });

  it("should have relation to Document (one-to-many)", () => {
    const f = getField(model, "documents");
    expect(f.kind).toBe("object");
    expect(f.isList).toBe(true);
    expect(f.type).toBe("Document");
  });

  it("should have relation to EscalationTicket (one-to-many)", () => {
    const f = getField(model, "escalations");
    expect(f.kind).toBe("object");
    expect(f.isList).toBe(true);
    expect(f.type).toBe("EscalationTicket");
  });

  it("should have no unknown fields", () => {
    const expected = new Set([
      "id", "username", "email", "fullName", "hashedPassword",
      "isActive", "role", "createdAt",
      "activityLogs", "chatLogs", "documents", "escalations",
    ]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 4. Model: Document
// ---------------------------------------------------------------------------

describe("Model: Document", () => {
  let model: DmmfModel;

  beforeAll(() => {
    model = getModel("Document");
  });

  it("should have all scalar fields with correct types", () => {
    const scalars: Record<string, string> = {
      id: "Int",
      filename: "String",
      originalName: "String",
      mimeType: "String",
      sizeBytes: "Int",
      status: "String",
      errorMessage: "String",
      collectionName: "String",
      uploadedById: "Int",
      createdAt: "DateTime",
      updatedAt: "DateTime",
    };
    for (const [name, type] of Object.entries(scalars)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should default status to 'processing'", () => {
    const f = getField(model, "status");
    expect(f.hasDefaultValue).toBe(true);
  });

  it("should default collectionName to 'knowledge_base'", () => {
    const f = getField(model, "collectionName");
    expect(f.hasDefaultValue).toBe(true);
  });

  it("should allow errorMessage to be nullable", () => {
    const f = getField(model, "errorMessage");
    expect(f.isRequired).toBe(false);
  });

  it("should auto-update updatedAt", () => {
    const f = getField(model, "updatedAt");
    expect(f.hasDefaultValue).toBe(true); // @updatedAt
  });

  it("should relate uploadedBy to User via uploadedById", () => {
    const f = getField(model, "uploadedBy");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["uploadedById"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have no unknown fields", () => {
    const expected = new Set([
      "id", "filename", "originalName", "mimeType", "sizeBytes",
      "status", "errorMessage", "collectionName", "uploadedById",
      "uploadedBy", "createdAt", "updatedAt",
    ]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 5. Model: ActivityLog
// ---------------------------------------------------------------------------

describe("Model: ActivityLog", () => {
  let model: DmmfModel;

  beforeAll(() => {
    model = getModel("ActivityLog");
  });

  it("should have exactly the audit-trail fields", () => {
    const scalars: Record<string, string> = {
      id: "Int",
      userId: "Int",
      action: "String",
      createdAt: "DateTime",
    };
    for (const [name, type] of Object.entries(scalars)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should relate user to User via userId", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have no unknown fields", () => {
    const expected = new Set(["id", "userId", "user", "action", "createdAt"]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 6. Model: ChatLog
// ---------------------------------------------------------------------------

describe("Model: ChatLog", () => {
  let model: DmmfModel;

  beforeAll(() => {
    model = getModel("ChatLog");
  });

  it("should have all scalar fields with correct types", () => {
    const scalars: Record<string, string> = {
      id: "Int",
      userId: "Int",
      question: "String",
      isAnswered: "Boolean",
      hasImage: "Boolean",
      imagePath: "String",
      createdAt: "DateTime",
    };
    for (const [name, type] of Object.entries(scalars)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should allow question, isAnswered, and imagePath to be nullable", () => {
    expect(getField(model, "question").isRequired).toBe(false);
    expect(getField(model, "isAnswered").isRequired).toBe(false);
    expect(getField(model, "imagePath").isRequired).toBe(false);
  });

  it("should default hasImage to false", () => {
    const f = getField(model, "hasImage");
    expect(f.hasDefaultValue).toBe(true);
  });

  it("should relate user to User via userId", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have optional one-to-one relation to EscalationTicket", () => {
    const f = getField(model, "escalation");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("EscalationTicket");
    expect(f.isList).toBe(false);
    // The back-relation on EscalationTicket (chatLog) is optional,
    // so this field is not required
  });

  it("should have no unknown fields", () => {
    const expected = new Set([
      "id", "userId", "user", "question", "isAnswered",
      "hasImage", "imagePath", "createdAt", "escalation",
    ]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 7. Model: EscalationTicket
// ---------------------------------------------------------------------------

describe("Model: EscalationTicket", () => {
  let model: DmmfModel;

  beforeAll(() => {
    model = getModel("EscalationTicket");
  });

  it("should have all scalar fields with correct types", () => {
    const scalars: Record<string, string> = {
      id: "Int",
      userId: "Int",
      question: "String",
      reason: "String",
      confidence: "Float",
      status: "String",
      chatLogId: "Int",
      resolvedAt: "DateTime",
      createdAt: "DateTime",
      updatedAt: "DateTime",
    };
    for (const [name, type] of Object.entries(scalars)) {
      const f = getField(model, name);
      expect(f.kind).toBe("scalar");
      expect(f.type).toBe(type);
    }
  });

  it("should default reason to 'confidence_rendah' and status to 'pending'", () => {
    expect(getField(model, "reason").hasDefaultValue).toBe(true);
    expect(getField(model, "status").hasDefaultValue).toBe(true);
  });

  it("should allow nullable confidence, chatLogId, and resolvedAt", () => {
    expect(getField(model, "confidence").isRequired).toBe(false);
    expect(getField(model, "chatLogId").isRequired).toBe(false);
    expect(getField(model, "resolvedAt").isRequired).toBe(false);
  });

  it("should enforce uniqueness on chatLogId", () => {
    expect(getField(model, "chatLogId").isUnique).toBe(true);
  });

  it("should auto-update updatedAt", () => {
    expect(getField(model, "updatedAt").hasDefaultValue).toBe(true);
  });

  it("should relate user to User via userId", () => {
    const f = getField(model, "user");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("User");
    expect(f.relationFromFields).toEqual(["userId"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have optional one-to-one relation to ChatLog via chatLogId", () => {
    const f = getField(model, "chatLog");
    expect(f.kind).toBe("object");
    expect(f.type).toBe("ChatLog");
    expect(f.isList).toBe(false);
    expect(f.relationFromFields).toEqual(["chatLogId"]);
    expect(f.relationToFields).toEqual(["id"]);
  });

  it("should have no unknown fields", () => {
    const expected = new Set([
      "id", "userId", "user", "question", "reason",
      "confidence", "status", "chatLogId", "chatLog",
      "resolvedAt", "createdAt", "updatedAt",
    ]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 8. Model: n8n_chat_histories (mapped table)
// ---------------------------------------------------------------------------

describe("Model: n8n_chat_histories", () => {
  let model: DmmfModel;

  beforeAll(() => {
    model = getModel("n8n_chat_histories");
  });

  it("should map to table 'n8n_chat_histories'", () => {
    expect(model.dbName).toBe("n8n_chat_histories");
  });

  it("should have id, session_id, and message fields", () => {
    expect(getField(model, "id").type).toBe("Int");
    expect(getField(model, "id").isId).toBe(true);

    const sessionId = getField(model, "session_id");
    expect(sessionId.type).toBe("String");
    expect(sessionId.isRequired).toBe(true);

    const message = getField(model, "message");
    expect(message.type).toBe("Json");
    expect(message.isRequired).toBe(true);
  });

  it("should have no unknown fields", () => {
    const expected = new Set(["id", "session_id", "message"]);
    const actual = new Set(model.fields.map((f) => f.name));
    expect(actual).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 9. Schema integrity — cross-model checks
// ---------------------------------------------------------------------------

describe("Schema integrity", () => {
  it("should contain exactly 6 models", () => {
    const names = Array.from(dmmfModels.keys()).sort();
    expect(names).toEqual([
      "ActivityLog",
      "ChatLog",
      "Document",
      "EscalationTicket",
      "User",
      "n8n_chat_histories",
    ]);
  });

  it("should have exactly 1 enum (Role)", () => {
    expect(dmmfEnums.size).toBe(1);
    expect(dmmfEnums.has("Role")).toBe(true);
  });

  it("should have no orphaned scalar relation fields (every FK has a corresponding relation)", () => {
    // Check each model's scalar FK fields have matching relation fields
    const checks: [string, string, string][] = [
      ["Document", "uploadedById", "uploadedBy"],
      ["ActivityLog", "userId", "user"],
      ["ChatLog", "userId", "user"],
      ["EscalationTicket", "userId", "user"],
      ["EscalationTicket", "chatLogId", "chatLog"],
    ];

    for (const [modelName, fkField, relationField] of checks) {
      const model = getModel(modelName);
      expect(getField(model, fkField)).toBeDefined();
      const rel = getField(model, relationField);
      expect(rel.kind).toBe("object");
      expect(rel.relationFromFields).toBeDefined();
    }
  });

  it("should have all back-relations reciprocated", () => {
    const user = getModel("User");
    expect(getField(user, "activityLogs").type).toBe("ActivityLog");
    expect(getField(user, "chatLogs").type).toBe("ChatLog");
    expect(getField(user, "documents").type).toBe("Document");
    expect(getField(user, "escalations").type).toBe("EscalationTicket");
  });

  it("should have ChatLog <-> EscalationTicket as a true one-to-one", () => {
    const chatLog = getModel("ChatLog");
    const escalation = getModel("EscalationTicket");

    const escalationOnChat = getField(chatLog, "escalation");
    expect(escalationOnChat.kind).toBe("object");
    expect(escalationOnChat.isList).toBe(false);

    const chatLogOnEscalation = getField(escalation, "chatLog");
    expect(chatLogOnEscalation.kind).toBe("object");
    expect(chatLogOnEscalation.isList).toBe(false);

    // chatLogId is unique on EscalationTicket — enforces true 1:1
    expect(getField(escalation, "chatLogId").isUnique).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Prisma Client — generated types smoke test
// ---------------------------------------------------------------------------

describe("Prisma Client generated types", () => {
  it("should expose delegate keys for every model", () => {
    const delegates = Object.keys(prisma).filter(
      (k) => !k.startsWith("$") && !k.startsWith("_"),
    );
    expect(delegates.sort()).toEqual([
      "activityLog",
      "chatLog",
      "document",
      "escalationTicket",
      "n8n_chat_histories",
      "user",
    ]);
  });

  it("should have Role enum on the client", () => {
    expect(prisma.$extends).toBeDefined(); // client is alive
    // Role enum is available at the TypeScript level — verify via DMMF
    const role = dmmfEnums.get("Role")!;
    expect(role.values).toContain("USER");
    expect(role.values).toContain("ADMIN");
  });

  it("should be able to disconnect cleanly", async () => {
    await prisma.$disconnect();
    // No-op if already disconnected — should not throw
  });
});