export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class DocumentationValidator {
  private requiredSections = [
    "# Overview",
    "## Problem Statement",
    "## Solution",
    "## Changes",
    "## Testing",
    "## Dependencies",
    "## Notes",
  ];

  private forbiddenPhrases = [
    "I think",
    "I believe",
    "maybe",
    "possibly",
    "I apologize",
    "I'm sorry",
    "I guess",
  ];

  validate(content: string): ValidationResult {
    const errors: string[] = [];

    // Check for required sections
    for (const section of this.requiredSections) {
      if (!content.includes(section)) {
        errors.push(`Missing required section: ${section}`);
      }
    }

    // Check for forbidden phrases (case insensitive)
    const lowerContent = content.toLowerCase();
    for (const phrase of this.forbiddenPhrases) {
      if (lowerContent.includes(phrase.toLowerCase())) {
        errors.push(`Contains forbidden phrase: "${phrase}"`);
      }
    }

    // Check for emojis (basic check for common emoji ranges)
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(content)) {
      errors.push("Contains emojis (forbidden)");
    }

    // Check that sections appear in order
    const sectionPositions = this.requiredSections.map((section) => ({
      section,
      position: content.indexOf(section),
    }));

    for (let i = 1; i < sectionPositions.length; i++) {
      if (
        sectionPositions[i].position !== -1 &&
        sectionPositions[i - 1].position !== -1 &&
        sectionPositions[i].position < sectionPositions[i - 1].position
      ) {
        errors.push(
          `Section "${sectionPositions[i].section}" appears before "${sectionPositions[i - 1].section}"`
        );
      }
    }

    // Check that Overview is at level 1 and others at level 2
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("## Overview")) {
        errors.push("Overview should be level 1 heading (# Overview), not level 2");
      }
      if (
        trimmed.match(/^# (Problem Statement|Solution|Changes|Testing|Dependencies|Notes)$/)
      ) {
        errors.push(
          `Section should be level 2 heading (##), not level 1: ${trimmed}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
