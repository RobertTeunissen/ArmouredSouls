import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
    },
  });

  console.log('Username length analysis:');
  console.log('========================\n');

  const lengths = users.map(u => ({
    username: u.username,
    usernameLen: u.username.length,
    emailLen: (u.username + '@legacy.local').length,
  }));

  lengths.sort((a, b) => b.emailLen - a.emailLen);

  console.log('Top 10 longest usernames (with email):');
  lengths.slice(0, 10).forEach(l => {
    console.log(`  ${l.username} (${l.usernameLen} chars) → ${l.username}@legacy.local (${l.emailLen} chars)`);
  });

  const tooLong = lengths.filter(l => l.emailLen > 20);
  console.log(`\n⚠️  ${tooLong.length} usernames would create emails longer than 20 characters`);
  
  if (tooLong.length > 0) {
    console.log('\nProblematic usernames:');
    tooLong.forEach(l => {
      console.log(`  ${l.username} → ${l.emailLen} chars (exceeds limit by ${l.emailLen - 20})`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
