import { Query, Resolver, Context } from '@nestjs/graphql';
import { UnauthorizedException } from '@nestjs/common';
import { ProjectLoader } from '../../loaders/project.loader';
import { TeamLoader } from '../../loaders/team.loader';
import { Project } from '../../project/project.model';
import { UserProfileDto } from '../../auth/dto/user-profile.dto';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { GqlContext } from '../../app.module';

@Resolver()
export class UserProjectsResolver {
  constructor(
    @InjectPinoLogger(UserProjectsResolver.name)
    private readonly logger: PinoLogger,
    private teamLoader: TeamLoader,
    private projectLoader: ProjectLoader,
  ) {}

  @Query(() => [Project])
  async myProjects(@Context() context: GqlContext): Promise<Project[]> {
    const currentUser = context.req.user as UserProfileDto;
    this.logger.debug({ userId: currentUser.id }, 'Executing myProjects query');

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    // Single optimized query to get user's teams with their projects
    const userTeams = await this.teamLoader.byUserId.load(currentUser.id);
    if (!userTeams || userTeams.length === 0) {
      return [];
    }

    // Efficiently get all projects for user's teams in one batch
    const teamIds = userTeams.map((team) => team.id);
    const projectsPerTeam = await this.projectLoader.byTeamId.loadMany(teamIds);

    // Create team name lookup map from already loaded data
    const teamNameMap = new Map<string, string>();
    userTeams.forEach((team) => {
      teamNameMap.set(team.id, team.name);
    });

    // Process and enrich projects with team names
    const allProjects = projectsPerTeam
      .flat()
      .filter((p): p is Project => p instanceof Error === false && p !== null)
      .map((project) => ({
        ...project,
        teamName: teamNameMap.get(project.teamId) || 'Unknown Team',
      }));

    this.logger.debug(
      {
        userId: currentUser.id,
        teamCount: userTeams.length,
        projectCount: allProjects.length,
      },
      'Successfully loaded user projects',
    );

    return allProjects;
  }
}
