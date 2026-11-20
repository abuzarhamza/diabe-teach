// GENERATED FILE: do not edit by hand.
// Source: docs/api/openapi.yaml (request bodies, $refs resolved), keyed by operationId.
// Regenerate with `npm run generate:request-schemas`; tests/request-schemas-generated.test.ts fails when stale.
// Dialect: JSON Schema 2020-12 for Ajv (`ajv/dist/2020`, option `discriminator: true`).

export const requestBodySchemas = {
  "signUpInstructor": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "email",
        "password"
      ],
      "properties": {
        "email": {
          "type": "string",
          "format": "email",
          "maxLength": 254
        },
        "password": {
          "type": "string",
          "minLength": 10,
          "maxLength": 1024
        }
      }
    }
  },
  "signInInstructor": {
    "required": true,
    "schema": {
      "type": "object",
      "description": "Unlike sign-up, nothing is required and no email or password rules apply: a missing field, a malformed email or a short password gets the same 401 INVALID_CREDENTIALS as a wrong password.",
      "properties": {
        "email": {
          "type": "string",
          "maxLength": 254
        },
        "password": {
          "type": "string",
          "maxLength": 1024
        }
      }
    }
  },
  "registerCurriculumPack": {
    "required": true,
    "schema": {
      "allOf": [
        {
          "type": "object",
          "required": [
            "id",
            "title",
            "version",
            "description",
            "boardConfig",
            "domains",
            "cards",
            "adjudicationRubric"
          ],
          "properties": {
            "id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "version": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "boardConfig": {
              "type": "object",
              "required": [
                "rows",
                "cols",
                "minChainLength",
                "adjacencyRule"
              ],
              "properties": {
                "rows": {
                  "type": "integer",
                  "minimum": 3,
                  "maximum": 12,
                  "default": 7
                },
                "cols": {
                  "type": "integer",
                  "minimum": 3,
                  "maximum": 12,
                  "default": 7
                },
                "minChainLength": {
                  "type": "integer",
                  "minimum": 2,
                  "default": 4
                },
                "adjacencyRule": {
                  "type": "string",
                  "enum": [
                    "chebyshev-8",
                    "orthogonal-4"
                  ],
                  "default": "chebyshev-8"
                }
              }
            },
            "domains": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "id",
                  "label",
                  "description"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "label": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  }
                }
              }
            },
            "cards": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "id",
                  "verbatimLabel",
                  "displayLabel",
                  "aliases",
                  "domainId",
                  "summary"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "verbatimLabel": {
                    "type": "string"
                  },
                  "displayLabel": {
                    "type": "string"
                  },
                  "aliases": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "domainId": {
                    "type": "string"
                  },
                  "summary": {
                    "type": "string"
                  }
                }
              }
            },
            "adjudicationRubric": {
              "type": "object",
              "required": [
                "evaluatorPersona",
                "subjectDomain",
                "chainContinuityCriteria",
                "calibrationExamples"
              ],
              "properties": {
                "evaluatorPersona": {
                  "type": "string"
                },
                "subjectDomain": {
                  "type": "string"
                },
                "chainContinuityCriteria": {
                  "type": "array",
                  "minItems": 1,
                  "items": {
                    "type": "string"
                  }
                },
                "calibrationBoardCardIds": {
                  "type": "array",
                  "description": "Optional fixed 2D matrix of card IDs (e.g., Figure 2 of the Diabe-teach paper)",
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                },
                "calibrationExamples": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "id",
                      "title",
                      "path",
                      "keywordIds",
                      "narrativeExplanation",
                      "isValid"
                    ],
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "title": {
                        "type": "string"
                      },
                      "path": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "required": [
                            "row",
                            "col"
                          ],
                          "properties": {
                            "row": {
                              "type": "integer",
                              "minimum": 0
                            },
                            "col": {
                              "type": "integer",
                              "minimum": 0
                            }
                          }
                        }
                      },
                      "keywordIds": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "narrativeExplanation": {
                        "type": "string"
                      },
                      "isValid": {
                        "type": "boolean"
                      },
                      "invalidReason": {
                        "type": [
                          "string",
                          "null"
                        ]
                      }
                    }
                  }
                }
              }
            },
            "assessmentInstrument": {
              "type": [
                "object",
                "null"
              ],
              "required": [
                "questions"
              ],
              "properties": {
                "questions": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "id",
                      "bloomLevel",
                      "stem",
                      "options",
                      "relatedKeywordIds"
                    ],
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "bloomLevel": {
                        "type": "integer",
                        "enum": [
                          2,
                          3
                        ]
                      },
                      "stem": {
                        "type": "string"
                      },
                      "options": {
                        "type": "array",
                        "minItems": 4,
                        "maxItems": 4,
                        "items": {
                          "type": "string"
                        }
                      },
                      "relatedKeywordIds": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "correctIndex": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 3,
                        "description": "Present only when requested with a valid instructorToken"
                      },
                      "explanation": {
                        "type": "string",
                        "description": "Present only when requested with a valid instructorToken"
                      }
                    }
                  }
                }
              }
            },
            "perceptionSurvey": {
              "type": [
                "object",
                "null"
              ],
              "required": [
                "items"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "id",
                      "prompt"
                    ],
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "prompt": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
  },
  "validateCurriculumPack": {
    "required": true,
    "schema": {
      "allOf": [
        {
          "type": "object",
          "required": [
            "id",
            "title",
            "version",
            "description",
            "boardConfig",
            "domains",
            "cards",
            "adjudicationRubric"
          ],
          "properties": {
            "id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "version": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "boardConfig": {
              "type": "object",
              "required": [
                "rows",
                "cols",
                "minChainLength",
                "adjacencyRule"
              ],
              "properties": {
                "rows": {
                  "type": "integer",
                  "minimum": 3,
                  "maximum": 12,
                  "default": 7
                },
                "cols": {
                  "type": "integer",
                  "minimum": 3,
                  "maximum": 12,
                  "default": 7
                },
                "minChainLength": {
                  "type": "integer",
                  "minimum": 2,
                  "default": 4
                },
                "adjacencyRule": {
                  "type": "string",
                  "enum": [
                    "chebyshev-8",
                    "orthogonal-4"
                  ],
                  "default": "chebyshev-8"
                }
              }
            },
            "domains": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "id",
                  "label",
                  "description"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "label": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  }
                }
              }
            },
            "cards": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "id",
                  "verbatimLabel",
                  "displayLabel",
                  "aliases",
                  "domainId",
                  "summary"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "verbatimLabel": {
                    "type": "string"
                  },
                  "displayLabel": {
                    "type": "string"
                  },
                  "aliases": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "domainId": {
                    "type": "string"
                  },
                  "summary": {
                    "type": "string"
                  }
                }
              }
            },
            "adjudicationRubric": {
              "type": "object",
              "required": [
                "evaluatorPersona",
                "subjectDomain",
                "chainContinuityCriteria",
                "calibrationExamples"
              ],
              "properties": {
                "evaluatorPersona": {
                  "type": "string"
                },
                "subjectDomain": {
                  "type": "string"
                },
                "chainContinuityCriteria": {
                  "type": "array",
                  "minItems": 1,
                  "items": {
                    "type": "string"
                  }
                },
                "calibrationBoardCardIds": {
                  "type": "array",
                  "description": "Optional fixed 2D matrix of card IDs (e.g., Figure 2 of the Diabe-teach paper)",
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                },
                "calibrationExamples": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "id",
                      "title",
                      "path",
                      "keywordIds",
                      "narrativeExplanation",
                      "isValid"
                    ],
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "title": {
                        "type": "string"
                      },
                      "path": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "required": [
                            "row",
                            "col"
                          ],
                          "properties": {
                            "row": {
                              "type": "integer",
                              "minimum": 0
                            },
                            "col": {
                              "type": "integer",
                              "minimum": 0
                            }
                          }
                        }
                      },
                      "keywordIds": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "narrativeExplanation": {
                        "type": "string"
                      },
                      "isValid": {
                        "type": "boolean"
                      },
                      "invalidReason": {
                        "type": [
                          "string",
                          "null"
                        ]
                      }
                    }
                  }
                }
              }
            },
            "assessmentInstrument": {
              "type": [
                "object",
                "null"
              ],
              "required": [
                "questions"
              ],
              "properties": {
                "questions": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "id",
                      "bloomLevel",
                      "stem",
                      "options",
                      "relatedKeywordIds"
                    ],
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "bloomLevel": {
                        "type": "integer",
                        "enum": [
                          2,
                          3
                        ]
                      },
                      "stem": {
                        "type": "string"
                      },
                      "options": {
                        "type": "array",
                        "minItems": 4,
                        "maxItems": 4,
                        "items": {
                          "type": "string"
                        }
                      },
                      "relatedKeywordIds": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "correctIndex": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 3,
                        "description": "Present only when requested with a valid instructorToken"
                      },
                      "explanation": {
                        "type": "string",
                        "description": "Present only when requested with a valid instructorToken"
                      }
                    }
                  }
                }
              }
            },
            "perceptionSurvey": {
              "type": [
                "object",
                "null"
              ],
              "required": [
                "items"
              ],
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": [
                      "id",
                      "prompt"
                    ],
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "prompt": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
  },
  "createGameSession": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "packId",
        "mode",
        "adjudicationMode"
      ],
      "properties": {
        "packId": {
          "type": "string",
          "default": "diabe-teach"
        },
        "mode": {
          "type": "string",
          "enum": [
            "solo",
            "classroom",
            "study-rct"
          ]
        },
        "adjudicationMode": {
          "type": "string",
          "enum": [
            "ai",
            "peer-instructor",
            "hybrid"
          ]
        },
        "timerConfig": {
          "type": "object",
          "additionalProperties": false,
          "description": "Phase durations in whole seconds (1 to 86400). Omitted fields use the default. Set a field to `null` to make that phase instructor-driven: it has no deadline (`phaseEndsAt` is `null`) and lasts until the instructor transitions it. An out-of-range duration or an unknown field is rejected with `INVALID_REQUEST_BODY`.\n",
          "properties": {
            "pretestSec": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 1,
              "maximum": 86400,
              "default": 900
            },
            "trialOrientationSec": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 1,
              "maximum": 86400,
              "default": 900
            },
            "roundMappingSec": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 1,
              "maximum": 86400,
              "default": 1200
            },
            "roundAdjudicationSec": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 1,
              "maximum": 86400,
              "default": 600
            },
            "posttestSec": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 1,
              "maximum": 86400,
              "default": 900
            },
            "feedbackSurveySec": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 1,
              "maximum": 86400,
              "default": 900
            }
          }
        },
        "seed": {
          "type": "string",
          "minLength": 1,
          "description": "Seeds Round 1's board, which the server deals when the session enters `round-1:chain-mapping`. The same Curriculum Pack, board size and seed always give the same board. A `seed` sent with that transition overrides it. Without either, the server generates a random seed. Round 2 never uses this seed.\n"
        },
        "creatorDisplayName": {
          "type": "string"
        }
      }
    }
  },
  "joinGameSession": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "roomCode"
      ],
      "properties": {
        "roomCode": {
          "type": "string"
        },
        "displayName": {
          "type": "string"
        }
      }
    }
  },
  "transitionSessionPhase": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "action"
      ],
      "properties": {
        "action": {
          "type": "string",
          "enum": [
            "advance",
            "jump"
          ],
          "default": "advance",
          "description": "`advance` moves to the next phase in the Game Session order. `jump` moves to `targetPhase`, which must be that same next phase: there is no skipping ahead or going back, and any other `targetPhase` gets 409 INVALID_PHASE_TRANSITION. To finish a Game Session early, use `endGameSession` (`POST /api/v1/sessions/{sessionId}/end`), not `jump`.\n"
        },
        "targetPhase": {
          "description": "Required with `jump` (400 INVALID_REQUEST_BODY without it) and ignored by `advance`: the phase to move to, which must be the next phase.\n",
          "type": "string",
          "enum": [
            "pretest",
            "trial-orientation",
            "round-1:chain-mapping",
            "round-1:peer-adjudication",
            "round-1:round-summary",
            "round-2:chain-mapping",
            "round-2:peer-adjudication",
            "round-2:round-summary",
            "posttest",
            "feedback-survey",
            "completed"
          ]
        },
        "seed": {
          "type": "string",
          "minLength": 1,
          "description": "Seeds the board of the round this transition enters (`round-1:chain-mapping` or `round-2:chain-mapping`), overriding the session's creation seed for Round 1. Without it, Round 1 uses the creation seed and otherwise the server generates a random seed. Ignored for transitions that enter no round.\n"
        }
      }
    }
  },
  "extendSessionPhase": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "seconds"
      ],
      "additionalProperties": false,
      "properties": {
        "seconds": {
          "type": "integer",
          "minimum": 1,
          "maximum": 600,
          "description": "Whole seconds to add to the current phase's deadline."
        }
      }
    }
  },
  "submitConceptChain": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "path",
        "narrativeExplanation"
      ],
      "properties": {
        "path": {
          "type": "array",
          "minItems": 2,
          "items": {
            "type": "object",
            "required": [
              "row",
              "col"
            ],
            "properties": {
              "row": {
                "type": "integer",
                "minimum": 0
              },
              "col": {
                "type": "integer",
                "minimum": 0
              }
            }
          }
        },
        "narrativeExplanation": {
          "type": "string",
          "minLength": 1
        },
        "keywordIds": {
          "type": "array",
          "deprecated": true,
          "description": "Deprecated; send only `path`. Ignored for a round with a server-dealt board: the server derives the chain's keyword ids from the board at each path cell. Accepted (not rejected) so older clients keep working. Only for a session stored before boards were dealt (no `activeBoard`) are these ids stored as sent, defaulting to an empty list.",
          "items": {
            "type": "string"
          }
        },
        "stepRationales": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "The learner's reason for one link of the chain, as plain text. Item i of `stepRationales` explains the step from `path[i]` to `path[i + 1]`."
          }
        }
      }
    }
  },
  "adjudicateConceptChain": {
    "required": true,
    "schema": {
      "type": "object",
      "oneOf": [
        {
          "type": "object",
          "required": [
            "action"
          ],
          "properties": {
            "action": {
              "type": "string",
              "enum": [
                "peer-approve",
                "peer-challenge"
              ]
            },
            "comment": {
              "type": "string"
            }
          }
        },
        {
          "type": "object",
          "required": [
            "action"
          ],
          "properties": {
            "action": {
              "type": "string",
              "const": "ai-evaluate"
            }
          }
        },
        {
          "type": "object",
          "required": [
            "action",
            "feedback"
          ],
          "properties": {
            "action": {
              "type": "string",
              "enum": [
                "instructor-approve",
                "instructor-reject"
              ]
            },
            "feedback": {
              "type": "string",
              "minLength": 1
            },
            "qualityScore": {
              "type": "number",
              "minimum": 1,
              "maximum": 10
            }
          }
        }
      ],
      "discriminator": {
        "propertyName": "action"
      }
    }
  },
  "submitAssessmentAttempt": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "answers"
      ],
      "properties": {
        "answers": {
          "type": "object",
          "additionalProperties": {
            "oneOf": [
              {
                "type": "integer",
                "enum": [
                  0,
                  1,
                  2,
                  3
                ]
              },
              {
                "type": "string",
                "const": "I_DONT_KNOW"
              }
            ]
          }
        }
      }
    }
  },
  "submitPerceptionSurvey": {
    "required": true,
    "schema": {
      "type": "object",
      "required": [
        "responses"
      ],
      "properties": {
        "responses": {
          "type": "object",
          "additionalProperties": {
            "type": "integer",
            "enum": [
              1,
              2,
              3,
              4,
              5
            ]
          }
        },
        "comments": {
          "type": "string"
        }
      }
    }
  }
} as const;

export type RequestBodyOperationId = keyof typeof requestBodySchemas;

/** Every operationId in the contract, with or without a request body. */
export const apiOperationIds = [
  "signUpInstructor",
  "signInInstructor",
  "getCurrentInstructorAccount",
  "listCurriculumPacks",
  "registerCurriculumPack",
  "validateCurriculumPack",
  "getCurriculumPackById",
  "archiveCurriculumPack",
  "unarchiveCurriculumPack",
  "createGameSession",
  "joinGameSession",
  "getGameSessionState",
  "streamGameSessionEvents",
  "transitionSessionPhase",
  "extendSessionPhase",
  "endGameSession",
  "leaveGameSession",
  "listRoundChains",
  "submitConceptChain",
  "adjudicateConceptChain",
  "getRoundStandings",
  "submitAssessmentAttempt",
  "submitPerceptionSurvey",
  "getSessionAnalytics"
] as const;

export type ApiOperationId = (typeof apiOperationIds)[number];
