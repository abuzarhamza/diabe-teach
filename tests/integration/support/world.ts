import type { APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenPort, CapabilityTokenSignerPort } from "../../../src/application/ports/capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "../../../src/application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import { World, setWorldConstructor } from "@cucumber/cucumber";
import { FakeClock } from "../../../src/adapters/outbound/fake-clock.js";

export interface TestDependencies {
  packRepo: CurriculumPackRepositoryPort;
  sessionRepo: GameSessionRepositoryPort;
  tokenAdapter: CapabilityTokenPort & CapabilityTokenSignerPort;
}

export class TestWorld extends World {
  public deps!: TestDependencies;

  /**
   * Controllable time source. Pass it as `clock` to handler factories built
   * in-process so scenarios can assert exact phase deadlines without sleeping.
   */
  public clock: FakeClock = new FakeClock();

  public currentSessionId: string | null = null;
  public roomCode: string | null = null;
  public instructorToken: string | null = null;

  public participantTokens: Map<string, string> = new Map();
  public participantIds: Map<string, string> = new Map();

  public lastResponse: APIGatewayProxyResult | null = null;
  public lastResponseBody: unknown = null;

  public lastChainId: string | null = null;

  /** A round's board noted from one response, to compare with later ones. */
  public notedBoard: unknown = null;

  /** The teacher's email for this scenario, unique per run. */
  public teacherEmail: string | null = null;
  /** The Instructor Account id returned by sign-up. */
  public signedUpAccountId: string | null = null;

  public reset(): void {
    this.clock = new FakeClock();
    this.currentSessionId = null;
    this.roomCode = null;
    this.instructorToken = null;
    this.participantTokens = new Map();
    this.participantIds = new Map();
    this.lastResponse = null;
    this.lastResponseBody = null;
    this.lastChainId = null;
    this.notedBoard = null;
    this.teacherEmail = null;
    this.signedUpAccountId = null;
  }

  public parseLastResponse(): void {
    if (this.lastResponse?.body) {
      this.lastResponseBody = JSON.parse(this.lastResponse.body);
    }
  }
}

setWorldConstructor(TestWorld);
