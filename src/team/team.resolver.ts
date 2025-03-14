import { Args, Mutation, Resolver, Query } from '@nestjs/graphql';
import { Team } from './team.model';
import { TeamService } from './team.service';
import { SimpleTeamDTO } from './team.model';

@Resolver(() => Team)
export class TeamResolver {
  constructor(private teamService: TeamService) {}

  @Mutation(() => Team)
  async createTeam(
    @Args('id') id: string,
    @Args('name') name: string,
  ): Promise<Team> {
    const team = await this.teamService.create(id, name);
    return {
      ...team,
      projects: [],
      rates: [],
    };
  }

  @Query(() => [SimpleTeamDTO])
  async getAllSimpleTeams(): Promise<SimpleTeamDTO[]> {
    return this.teamService.getAllSimpleTeams();
  }
}
