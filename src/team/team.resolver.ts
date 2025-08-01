import {
  Args,
  Mutation,
  Resolver,
  Query,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { Team } from './team.model';
import { TeamService } from './team.service';
import { SimpleTeamDTO } from './team.model';
import { ProjectLoader } from '../loaders/project.loader';
import { RateLoader } from '../loaders/rate.loader';
import { Project } from '../project/project.model';
import { Rate } from '../rate/rate.model';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { CreateTeamInput, GetTeamInput } from './team.input';

@Resolver(() => Team)
export class TeamResolver {
  constructor(
    @InjectPinoLogger(TeamResolver.name)
    private readonly logger: PinoLogger,
    private teamService: TeamService,
    private projectLoader: ProjectLoader,
    private rateLoader: RateLoader,
  ) {}

  @Mutation(() => Team)
  @Roles(UserRole.ADMIN)
  async createTeam(@Args('input') input: CreateTeamInput): Promise<Team> {
    this.logger.info({ input }, 'Executing createTeam mutation');

    const team = await this.teamService.create(input.id, input.name);

    // Return consistent structure - field resolvers will handle projects/rates
    return {
      ...team,
      projects: [],
      rates: [],
    };
  }

  @Query(() => [SimpleTeamDTO])
  @Roles(UserRole.ADMIN, UserRole.ENABLER, UserRole.COLLABORATOR)
  async getAllSimpleTeams(): Promise<SimpleTeamDTO[]> {
    this.logger.debug('Executing getAllSimpleTeams query');
    return this.teamService.getAllSimpleTeams();
  }

  @Query(() => Team)
  @Roles(UserRole.ADMIN, UserRole.ENABLER, UserRole.COLLABORATOR)
  async getTeam(@Args('input') input: GetTeamInput): Promise<Team> {
    this.logger.debug({ teamId: input.id }, 'Executing getTeam query');

    const team = await this.teamService.getTeamById(input.id);

    // Service throws if team not found, so team is guaranteed to exist
    return {
      ...team,
      projects: [],
      rates: [],
    };
  }

  @ResolveField(() => [Project])
  async projects(@Parent() team: Team): Promise<Project[]> {
    // This will be called only when projects field is requested
    // Uses DataLoader to batch and cache the requests
    return this.projectLoader.byTeamId.load(team.id);
  }

  @ResolveField(() => [Rate])
  async rates(@Parent() team: Team): Promise<Rate[]> {
    // This will be called only when rates field is requested
    // Uses DataLoader to batch and cache the requests
    return this.rateLoader.byTeamId.load(team.id);
  }
}
