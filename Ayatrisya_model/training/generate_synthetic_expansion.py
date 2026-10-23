from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "data" / "generated"
PROVENANCE = "assistant_authored_synthetic_example_for_Ayatrisya_experiment"
LICENSE_STATUS = "no_public_license_assigned_internal_review_required"

TRAIN_FAMILIES: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("math", "Calculate the sum and show a quick check.", [
        ("14 + 9", "14 + 9 = 23. Check: 23 - 9 = 14."),
        ("28 + 17", "28 + 17 = 45. Check: 45 - 17 = 28."),
        ("36 + 25", "36 + 25 = 61. Check: 61 - 25 = 36."),
        ("47 + 38", "47 + 38 = 85. Check: 85 - 38 = 47."),
    ]),
    ("math", "Find the difference and verify it.", [
        ("32 - 14", "32 - 14 = 18. Check: 18 + 14 = 32."),
        ("51 - 27", "51 - 27 = 24. Check: 24 + 27 = 51."),
        ("83 - 46", "83 - 46 = 37. Check: 37 + 46 = 83."),
        ("100 - 58", "100 - 58 = 42. Check: 42 + 58 = 100."),
    ]),
    ("math", "Multiply the numbers and include a check.", [
        ("7 × 8", "7 × 8 = 56. Check: 56 ÷ 8 = 7."),
        ("9 × 6", "9 × 6 = 54. Check: 54 ÷ 6 = 9."),
        ("12 × 4", "12 × 4 = 48. Check: 48 ÷ 4 = 12."),
        ("15 × 3", "15 × 3 = 45. Check: 45 ÷ 3 = 15."),
    ]),
    ("math", "Divide and verify by multiplication.", [
        ("72 ÷ 8", "72 ÷ 8 = 9. Check: 9 × 8 = 72."),
        ("96 ÷ 12", "96 ÷ 12 = 8. Check: 8 × 12 = 96."),
        ("81 ÷ 9", "81 ÷ 9 = 9. Check: 9 × 9 = 81."),
        ("144 ÷ 16", "144 ÷ 16 = 9. Check: 9 × 16 = 144."),
    ]),
    ("science", "Explain the science idea in the input in plain language.", [
        ("Why is lightning seen before thunder is heard?", "Light travels much faster than sound, so the flash reaches us before the sound."),
        ("What does evaporation do in the water cycle?", "Evaporation changes liquid water into water vapor, which rises into the air."),
        ("Why do plants need sunlight for photosynthesis?", "Light provides energy that plants use to turn water and carbon dioxide into sugars."),
        ("Why does a metal spoon feel cold in a room?", "Metal transfers heat away from your hand quickly, making the spoon feel cold."),
    ]),
    ("science", "Give the main cause of the observation described.", [
        ("A puddle gets smaller on a warm day.", "Heat gives water molecules energy to evaporate into water vapor."),
        ("A shadow changes length during the day.", "The Sun's apparent position changes, so the angle and length of the shadow change."),
        ("A ball slows down while rolling on grass.", "Friction between the ball and grass transfers motion energy into heat and sound."),
        ("Water droplets form on the outside of a cold glass.", "Water vapor in the air cools and condenses on the cold surface."),
    ]),
    ("science", "Answer this biology question with one accurate explanation.", [
        ("What is the role of roots?", "Roots anchor a plant and absorb water and minerals from the soil."),
        ("Why do people breathe faster during exercise?", "Working muscles need more oxygen and produce more carbon dioxide, so breathing increases."),
        ("What do decomposers do in an ecosystem?", "Decomposers break down dead material and return nutrients to the environment."),
        ("How does a vaccine help the immune system?", "A vaccine trains the immune system to recognize a pathogen without requiring the person to experience the full disease."),
    ]),
    ("science", "Describe the physical process named in the input.", [
        ("condensation", "Condensation is the change from gas to liquid when particles lose energy."),
        ("reflection", "Reflection occurs when light or another wave bounces from a surface."),
        ("conduction", "Conduction transfers heat through direct contact between particles."),
        ("freezing", "Freezing is the change from liquid to solid as a substance loses heat."),
    ]),
    ("programming", "Explain the Python concept in the input for a beginner.", [
        ("for loop", "A for loop repeats a block of code for each item in a sequence."),
        ("function", "A function is a named block of reusable code that can accept inputs and return a result."),
        ("list", "A list stores ordered items that can be accessed by their position."),
        ("dictionary", "A dictionary stores values under keys so code can look them up by name."),
    ]),
    ("programming", "State the output of this short Python expression.", [
        ("print(3 + 4)", "7"),
        ("print(len('cat'))", "3"),
        ("print(2 * 5)", "10"),
        ("print(10 // 3)", "3"),
    ]),
    ("programming", "Suggest the simplest fix for the code issue described.", [
        ("A variable is used before it receives a value.", "Assign the variable before the first line that reads it."),
        ("A loop never changes its stopping condition.", "Update the condition or loop variable so the loop can eventually stop."),
        ("A function returns None unexpectedly.", "Check that every intended result path reaches a return statement with a value."),
        ("A list index is out of range.", "Check the list length and use an index from zero through length minus one."),
    ]),
    ("programming", "Name one useful test for the function described.", [
        ("A function that adds two integers.", "Test positive values, zero, and at least one negative value."),
        ("A function that sorts a list.", "Test an empty list, an already sorted list, and a reversed list."),
        ("A function that checks a password length.", "Test values just below, at, and above the minimum length."),
        ("A function that converts Celsius to Fahrenheit.", "Test 0 Celsius and verify that the result is 32 Fahrenheit."),
    ]),
    ("writing", "Rewrite the note as one clear, polite sentence.", [
        ("send the report today if possible", "Could you please send the report today if possible?"),
        ("meeting moved to 3 bring the draft", "The meeting has moved to 3:00; please bring the draft."),
        ("i need the notes before class", "Could you share the notes before class?"),
        ("we fixed the issue try again", "We have fixed the issue; please try again."),
    ]),
    ("writing", "Correct the grammar and punctuation in the input.", [
        ("the files is ready", "The files are ready."),
        ("she dont have the final copy", "She doesn't have the final copy."),
        ("we was waiting for the update", "We were waiting for the update."),
        ("please review this when your free", "Please review this when you're free."),
    ]),
    ("writing", "Create a concise title for the topic in the input.", [
        ("how to study with short breaks", "Study Better with Short Breaks"),
        ("keeping project files organized", "A Simple System for Project Files"),
        ("testing a small web application", "A Practical Web App Testing Checklist"),
        ("learning from calculation errors", "Turn Calculation Errors into Progress"),
    ]),
    ("writing", "Give a short outline for the writing topic.", [
        ("A beginner's guide to budgeting", "1. Set a goal. 2. Track income and spending. 3. Choose limits. 4. Review and adjust."),
        ("How to prepare for an exam", "1. List topics. 2. Plan review sessions. 3. Practice retrieval. 4. Check weak areas."),
        ("Why clear documentation matters", "1. Explain the purpose. 2. Record steps. 3. Add examples. 4. Keep it current."),
        ("How to report a software bug", "1. State expected behavior. 2. Describe actual behavior. 3. Give steps to reproduce. 4. Attach safe evidence."),
    ]),
    ("study_skills", "Recommend one practical study action for the situation.", [
        ("I forget material after reading it once.", "Close the notes and try to recall the main ideas, then check what you missed."),
        ("I keep making sign errors in algebra.", "Keep an error log and redo similar problems while saying each sign change aloud."),
        ("I have a large chapter to review.", "Break it into small topics and schedule short spaced review sessions."),
        ("I cannot tell which topics I understand.", "Use a brief practice quiz without notes and mark questions that need review."),
    ]),
    ("study_skills", "Make a short revision plan for the time available.", [
        ("20 minutes", "Spend 5 minutes recalling key ideas, 10 minutes solving practice questions, and 5 minutes checking errors."),
        ("30 minutes", "Review one topic for 10 minutes, solve questions for 15 minutes, and summarize mistakes for 5 minutes."),
        ("45 minutes", "Use two focused 18-minute study blocks with a short break, then spend the final 5 minutes recalling key points."),
        ("60 minutes", "Study two topics in separate blocks, take a brief break, and finish with a closed-book self-test."),
    ]),
    ("study_skills", "Turn the learning problem into a measurable next step.", [
        ("I want to improve reading comprehension.", "After each page, write a one-sentence summary and one question from memory."),
        ("I want to learn vocabulary.", "Review a small set with spaced recall and use each word in a new sentence."),
        ("I want to improve coding.", "Write a small program, test edge cases, and explain one bug you fixed."),
        ("I want to retain science facts.", "Make short question-and-answer cards and revisit missed cards later."),
    ]),
    ("study_skills", "Suggest a way to reduce distractions during study.", [
        ("I check messages every few minutes.", "Silence notifications for one focused block and check messages during the planned break."),
        ("My desk is cluttered.", "Clear the work area and leave only the materials needed for the current task."),
        ("I keep switching subjects.", "Write a short task list and finish one defined block before changing subjects."),
        ("I feel overwhelmed by the workload.", "Choose the smallest useful next task and work on it for a short timed interval."),
    ]),
    ("reasoning", "Apply the stated ordering constraints and give a valid order.", [
        ("A comes before B; B comes before C.", "A, B, C"),
        ("Read before taking notes; take notes before reviewing.", "Read, take notes, review"),
        ("Test before release; review before test.", "Review, test, release"),
        ("Plan before building; build before checking.", "Plan, build, check"),
    ]),
    ("reasoning", "Separate the evidence from the conclusion in the input.", [
        ("The floor is wet, so it must have rained.", "Evidence: the floor is wet. Conclusion: it rained. The evidence alone does not prove the cause."),
        ("Three tests passed, so the program has no bugs.", "Evidence: three tests passed. Conclusion: the program has no bugs. Passing tests do not prove that all bugs are absent."),
        ("The plant grew after watering, so water may support its growth.", "Evidence: growth followed watering. Conclusion: water may support growth. More controlled observations would strengthen the claim."),
        ("One person liked the design, so everyone will like it.", "Evidence: one person liked the design. Conclusion: everyone will like it. One opinion cannot establish a universal preference."),
    ]),
    ("reasoning", "Check whether the conclusion follows from the facts.", [
        ("All squares have four sides. This shape is a square.", "The shape has four sides, because the facts say every square has four sides."),
        ("If the alarm is set, it will ring at 7. The alarm is set.", "The facts imply that it will ring at 7."),
        ("Some books are new. This item is a book.", "It is not possible to conclude that this book is new; the facts say only that some books are new."),
        ("If a file is encrypted, a key is needed. No key is available.", "The facts do not prove that the file is encrypted; they only describe what follows if it is."),
    ]),
    ("reasoning", "Compare the options using the criterion in the input.", [
        ("Choose the lower cost: option A costs 12, option B costs 9.", "Option B costs less: 9 compared with 12."),
        ("Choose the shorter time: route A takes 25 minutes, route B takes 18.", "Route B is shorter by time: 18 minutes compared with 25."),
        ("Choose the larger value: 0.8 or 0.65.", "0.8 is larger than 0.65."),
        ("Choose the smaller file: 4 MB or 950 KB.", "950 KB is smaller than 4 MB."),
    ]),
    ("privacy_safety", "Choose the safest next step for the situation.", [
        ("A stranger asks me to send my account password.", "Do not share the password. Use the service's official sign-in and report the request if appropriate."),
        ("A message asks me to open an unexpected attachment.", "Do not open it until you verify the sender and the file through a trusted channel."),
        ("A public post includes a private phone number.", "Remove or redact the number and share only the information needed."),
        ("A tool requests access to every file for a small task.", "Grant only the minimum access needed, or choose a safer tool."),
    ]),
    ("privacy_safety", "Explain how to handle the secret in the input.", [
        ("an API key", "Keep it in a secret manager or protected environment variable; never place it in public client code or chat."),
        ("a recovery code", "Store it in a secure location and share it with no one who asks unexpectedly."),
        ("a private key", "Restrict file access, keep it out of source control, and rotate it if exposure is suspected."),
        ("a session cookie", "Treat it as a credential; do not share it, and revoke the session if it may have leaked."),
    ]),
    ("privacy_safety", "Name the privacy-preserving action for the data described.", [
        ("a spreadsheet with customer details", "Use only the fields needed, restrict access, and remove or anonymize data when no longer required."),
        ("a screenshot showing an email address", "Redact the address before sharing the screenshot publicly."),
        ("a test dataset copied from real accounts", "Use approved, minimized, or synthetic data instead of unnecessary real account details."),
        ("a document sent to the wrong recipient", "Ask the recipient not to use or forward it, follow the incident process, and notify the responsible owner."),
    ]),
    ("privacy_safety", "Check the request before sharing any personal information.", [
        ("The requester and purpose are unclear.", "Pause and verify the requester, purpose, and minimum required information through a trusted channel."),
        ("The requested data is not needed for the task.", "Do not share it; provide only information necessary for the stated purpose."),
        ("The link uses an unfamiliar domain.", "Do not enter credentials; navigate to the service through its known official address."),
        ("The data will be posted publicly.", "Remove personal or confidential details and confirm that public sharing is authorized."),
    ]),
    ("planning", "Give a short ordered plan for the goal in the input.", [
        ("Build a small portfolio website.", "1. Define the pages. 2. Create the layout. 3. Add and test content. 4. Review mobile behavior and publish only after approval."),
        ("Prepare for a math test.", "1. List tested topics. 2. Review examples. 3. Solve practice problems. 4. Recheck mistakes."),
        ("Investigate a reproducible software bug.", "1. Record expected behavior. 2. Find minimal reproduction steps. 3. Inspect relevant code. 4. Test the fix and regression cases."),
        ("Organize a research presentation.", "1. State the question. 2. Group verified evidence. 3. Build a clear story. 4. Rehearse and check sources."),
    ]),
    ("planning", "Break the project into clear milestones.", [
        ("Create a simple note-taking app.", "1. Define note fields. 2. Build create and edit flows. 3. Add persistence. 4. Test accessibility and recovery."),
        ("Learn a new programming language.", "1. Learn basic syntax. 2. Write small exercises. 3. Build a small project. 4. Review errors and document progress."),
        ("Improve an existing landing page.", "1. Identify user goals. 2. Review layout and content. 3. Implement focused changes. 4. Test at phone and desktop sizes."),
        ("Prepare a dataset for a model experiment.", "1. Verify source and permission. 2. Validate schema and privacy. 3. Split by source or template. 4. Record evaluation limits."),
    ]),
    ("planning", "Create a practical checklist for completing the task.", [
        ("Release a desktop installer.", "Check the source revision, build on a native runner, inspect the installer, test clean install and launch, then publish with verified notices."),
        ("Review a privacy policy.", "Verify each data flow, mark unknowns, confirm deletion controls, obtain qualified review, and keep approval status accurate."),
        ("Test a website form.", "Check required fields, invalid input, success state, error recovery, keyboard use, and phone layout."),
        ("Review a model result.", "Record the dataset split, baseline, metric, sample outputs, failure cases, and limits before making claims."),
    ]),
    ("planning", "Put the work in a sensible order and include a review point.", [
        ("Update a shared documentation page.", "1. Confirm the requested change. 2. Draft and check the content. 3. Ask an owner to review it. 4. Publish only after approval."),
        ("Fix a bug in a small application.", "1. Reproduce the bug. 2. Identify the cause. 3. Make the smallest fix. 4. Run regression tests and review the result."),
        ("Prepare a personal study project.", "1. Define the goal. 2. Gather allowed materials. 3. Work through small milestones. 4. Review progress and adjust the plan."),
        ("Add a new feature to a product.", "1. Define user behavior. 2. Check risks and dependencies. 3. Implement and test. 4. Review usability before release."),
    ]),
]

EVAL_FAMILIES: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("math", "Show a clean solution and a final arithmetic verification.", [
        ("11 + 17", "11 + 17 = 28. Check: 28 - 17 = 11."),
        ("42 - 19", "42 - 19 = 23. Check: 23 + 19 = 42."),
        ("6 × 8", "6 × 8 = 48. Check: 48 ÷ 8 = 6."),
        ("72 ÷ 9", "72 ÷ 9 = 8. Check: 8 × 9 = 72."),
    ]),
    ("science", "Teach the science mechanism in everyday language.", [
        ("Why does a shadow move?", "A shadow moves because the light source or the object changes position, changing where the light is blocked."),
        ("How does condensation happen?", "Condensation happens when water vapor cools and changes into liquid droplets."),
        ("Why does sound fade with distance?", "Sound energy spreads out and is absorbed by materials, so less reaches a distant listener."),
        ("What do plant leaves exchange with the air?", "Leaves take in carbon dioxide and release oxygen during photosynthesis, while also exchanging water vapor."),
    ]),
    ("programming", "Review this Python snippet and explain its result.", [
        ("print(sum([2, 3, 4]))", "The code adds the list values and prints 9."),
        ("for x in range(2): print(x)", "The loop prints 0 and then 1."),
        ("print('go' * 3)", "The code prints gogogo."),
        ("print(max([4, 1, 7]))", "The code prints 7, the largest value in the list."),
    ]),
    ("writing", "Turn the draft into a polite, concise message.", [
        ("need your feedback by friday", "Could you please share your feedback by Friday?"),
        ("the build is ready check it", "The build is ready; could you please review it?"),
        ("cant join send notes", "I can't join; could you please send me the notes?"),
        ("thanks got the file", "Thank you; I received the file."),
    ]),
    ("study_skills", "Recommend an evidence-informed next step for the learner.", [
        ("I recognize answers but cannot recall them unaided.", "Practice active recall by answering questions without notes, then check and revisit missed points later."),
        ("I understand examples but struggle with new problems.", "Try a varied practice problem and explain which principle applies before looking at a solution."),
        ("I forget a topic after a week.", "Schedule spaced review sessions and retrieve the key ideas from memory each time."),
        ("I keep repeating the same mistake.", "Classify the error, write the correct rule, and solve a new similar problem without copying the example."),
    ]),
    ("reasoning", "Check the conclusion against the stated evidence.", [
        ("Every registered item has a label. This item is registered.", "The item has a label."),
        ("A test passed once, so it will always pass.", "That conclusion is too strong; one pass does not prove it will always pass."),
        ("The train is delayed when the signal fails. The signal failed.", "The stated rule supports that the train is delayed."),
        ("Some tools are free. This tool is a tool.", "The facts do not show whether this particular tool is free."),
    ]),
    ("privacy_safety", "Choose a safe response to this information-sharing request.", [
        ("Someone requests a one-time login code.", "Do not share the code. Verify the request through the service's official channel."),
        ("A report contains data unrelated to the recipient's task.", "Remove the unnecessary data and share only the minimum authorized information."),
        ("A link asks for a password after an unexpected message.", "Do not enter the password through the link; visit the known official site directly."),
        ("A shared folder is open to everyone by default.", "Restrict access to approved people and review permissions before sharing."),
    ]),
    ("planning", "Provide an ordered, practical four-step plan for the goal.", [
        ("Write and test a command-line calculator.", "1. Define supported operations. 2. Implement input parsing and calculations. 3. Test normal and edge cases. 4. Document usage and limitations."),
        ("Prepare a short science lesson.", "1. Set one learning goal. 2. Choose verified examples. 3. Explain and practice the idea. 4. Check understanding with a short question."),
        ("Investigate a slow page.", "1. Reproduce the delay. 2. Measure the main requests and rendering. 3. Fix the largest verified cause. 4. Retest on phone and desktop."),
        ("Back up important project files.", "1. Identify needed files. 2. Choose an approved secure destination. 3. Create and verify the backup. 4. Test restoration and record the date."),
    ]),
]


def build_records(
    families: list[tuple[str, str, list[tuple[str, str]]]],
) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for category, instruction, examples in families:
        for user_input, output in examples:
            records.append(
                {
                    "instruction": instruction,
                    "input": user_input,
                    "output": output,
                    "category": category,
                    "provenance": PROVENANCE,
                    "license": LICENSE_STATUS,
                }
            )
    return records


def write_jsonl(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in records),
        encoding="utf-8",
    )


def main() -> None:
    train_records = build_records(TRAIN_FAMILIES)
    eval_records = build_records(EVAL_FAMILIES)
    train_instructions = {row["instruction"].casefold() for row in train_records}
    eval_instructions = {row["instruction"].casefold() for row in eval_records}
    if train_instructions & eval_instructions:
        raise ValueError("training and external evaluation templates must be distinct")
    write_jsonl(GENERATED / "synthetic-expansion-train.jsonl", train_records)
    write_jsonl(GENERATED / "synthetic-expansion-eval.jsonl", eval_records)
    print(
        json.dumps(
            {
                "training_records": len(train_records),
                "training_instruction_families": len(train_instructions),
                "external_eval_records": len(eval_records),
                "external_eval_instruction_families": len(eval_instructions),
                "external_eval_templates_overlap": False,
                "provenance": PROVENANCE,
                "license_status": LICENSE_STATUS,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
