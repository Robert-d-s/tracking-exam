import { Injectable} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, Prisma } from '@prisma/client';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { InternalServerErrorException } from '@nestjs/common';
import { UserQueryArgs } from './user.resolver';

type TeamBasic = {
  id: string;
  name: string;
};

type UserTeamDTO = {
  userId: number;
  teamId: string;
  user: {
    id: number;
    email: string;
    password?: string | null;
    role: UserRole;
  };
  team: TeamBasic;
};

@Injectable()
export class UserService {
    constructor(@InjectPinoLogger(UserService.name) private readonly logger: PinoLogger, private prisma: PrismaService) {}
  async findOne(email: string): Promise<User | undefined> {
    this.logger.debug({ email }, 'Finding user by email');
    const user = await this.prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (user) {
      return {
        ...user,
        role: UserRole[user.role as keyof typeof UserRole],
      };
    }

    return undefined;
  }

  async create(
    email: string,
    hashedPassword: string,
    role: UserRole,
  ): Promise<User> {
    this.logger.info({ email, role }, 'Creating user');
    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });
  }

  async count(): Promise<number> {
    this.logger.debug('Counting all users');
    return this.prisma.user.count();
  }

  async updateUserRole(userId: number, newRole: UserRole): Promise<User> {
    this.logger.info({ userId, newRole }, 'Updating user role');
    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role: newRole,
      },
    });

    return {
      ...updatedUser,
      role: UserRole[updatedUser.role as keyof typeof UserRole],
    };
  }

  async addUserToTeam(userId: number, teamId: string): Promise<User> {
    this.logger.info({ userId, teamId }, 'Adding user to team');
    return this.prisma.$transaction(async (tx) => {
      const userExists = await tx.user.findUnique({
        where: { id: userId },
      });
      const teamExists = await tx.team.findUnique({
        where: { id: teamId },
      });

      if (!userExists || !teamExists) {
        this.logger.error({ userId, teamId, userExists, teamExists }, 'User or Team not found for adding relation');
        throw new Error('User or Team not found');
      }

      const existingRelation = await tx.userTeam.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
      });

      if (!existingRelation) {
        await tx.userTeam.create({
          data: {
            userId,
            teamId,
          },
        });
      }
      this.logger.debug({ userId, teamId }, 'Created UserTeam relation if it did not exist');
      // Get the updated user with teams within the transaction
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          teams: {
            include: {
              team: {
                include: {
                  projects: true,
                  rates: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        this.logger.error({ userId }, 'User not found after adding to team within transaction');
        throw new Error(
          `User with ID ${userId} not found after adding to team`,
        );
      }

      return user;
    });
  }

  private async getUserWithTeams(userId: number): Promise<any> {
    this.logger.trace({ userId }, 'Fetching user with teams');
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        teams: {
          include: {
            team: {
              include: {
                projects: true,
                rates: true,
              },
            },
          },
        },
      },
    });
  }

  async removeUserFromTeam(userId: number, teamId: string): Promise<User> {
    this.logger.info({ userId, teamId }, 'Removing user from team');
    try {
      await this.prisma.$transaction(async (tx) => {
        this.logger.debug({ userId, teamId }, 'Executing deleteMany within transaction');
        await tx.userTeam.deleteMany({
          where: {
            userId: userId,
            teamId: teamId,
          },
        });
      });
  
      this.logger.info({ userId, teamId }, 'Successfully removed UserTeam relation');
      const updatedUser = await this.getUserWithTeams(userId);
      if (!updatedUser) {
           this.logger.error({ userId }, "User not found after successful team removal");
           throw new InternalServerErrorException("Failed to retrieve user state after update");
      }
      this.logger.trace({ userId, teamCount: updatedUser?.teams?.length ?? 0 }, 'User team state after removal (fetched post-tx)');
  
      return updatedUser;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
           this.logger.error({ err: error, userId, teamId }, 'Transaction timeout during user removal');
           throw new InternalServerErrorException("Database operation timed out during team removal.");
      } else {
          this.logger.error({ err: error, userId, teamId }, 'Failed to remove user from team');
          throw error;
      }
    }
  }

  async countUsersWithFilters(args: {
    search?: string;
    role?: UserRole;
  }): Promise<number> {
    this.logger.debug({ filterArgs: args }, 'Counting users with filters');
    const where: Prisma.UserWhereInput = {};
    if (args.search) {
      where.email = { contains: args.search };
    }
    if (args.role) {
      where.role = args.role;
    }
    return this.prisma.user.count({ where });
  }

  // Method to Find users with filters and pagination (Required for users query)
  async findUsers(
    args: UserQueryArgs,
  ): Promise<Array<Pick<User, 'id' | 'email' | 'role'>>> { // Return type matches resolver needs
    this.logger.debug({ queryArgs: args }, 'Finding users with filters and pagination');
    const currentPage = args.page ?? 1;
    const currentPageSize = args.pageSize ?? 10;

    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where: Prisma.UserWhereInput = {};
    if (args.search) {
      where.email = { contains: args.search };
    }
    if (args.role) {
      where.role = args.role;
    }

    // Return only the fields needed by the resolver/GraphQL type
    return this.prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        email: true,
        role: true, // Prisma returns the enum value
      },
      orderBy: {
        email: 'asc',
      },
    });
  }
}
