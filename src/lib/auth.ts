import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || !user.isActive) return null;

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          // Increment failed logins
          const failedLogins = user.failedLogins + 1;
          const updateData: any = { failedLogins };

          // Lock account after 5 failed attempts for 15 minutes
          if (failedLogins >= 5) {
            updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            updateData.failedLogins = 0;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          return null;
        }

        // Reset failed logins on successful auth
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          username: user.username,
          languagePref: user.languagePref,
          themePref: user.themePref,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.languagePref = (user as any).languagePref;
        token.themePref = (user as any).themePref;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session.user as any).languagePref = token.languagePref;
        (session.user as any).themePref = token.themePref;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
});
