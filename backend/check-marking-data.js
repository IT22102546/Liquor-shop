const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkMarkingData() {
  try {
    const exams = await prisma.exam.findMany({
      where: {
        title: {
          contains: "Advanced Science",
        },
      },
      include: {
        questions: true,
        attempts: {
          include: {
            answers: true,
          },
        },
      },
    });

    console.log("✅ Found exams:", exams.length);

    exams.forEach((exam) => {
      console.log("\n📚 Exam:", exam.title);
      console.log("   ID:", exam.id);
      console.log("   Status:", exam.status);
      console.log("   Questions:", exam.questions.length);
      console.log("   Attempts:", exam.attempts.length);

      const essayQuestions = exam.questions.filter(
        (q) => q.type === "ESSAY" || q.type === "SHORT_ANSWER"
      );
      console.log("   Essay/Short Answer Questions:", essayQuestions.length);

      if (essayQuestions.length > 0) {
        console.log("\n   Question Details:");
        essayQuestions.forEach((q) => {
          console.log(
            `     - ${q.type}: ${q.question.substring(0, 50)}... (${q.points} marks)`
          );
          console.log(`       ID: ${q.id}`);
        });
      }

      if (exam.attempts.length > 0) {
        console.log("\n   Attempt Details:");
        exam.attempts.forEach((attempt, idx) => {
          console.log(`     ${idx + 1}. Attempt ID: ${attempt.id}`);
          console.log(`        Status: ${attempt.status}`);
          console.log(`        Answers: ${attempt.answers.length}`);
          console.log(
            `        Submitted: ${attempt.submittedAt ? "Yes" : "No"}`
          );
        });
      }
    });

    if (exams.length === 0) {
      console.log("\n⚠️  No marking test exam found!");
      console.log("   Run: npm run seed to create test data");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMarkingData();
