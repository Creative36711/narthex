неясно: как сохранить работу правил после переноса ruleConditionsOk из фасада, не оставляя мёртвый private-делегатор.
решил: effects.ts и encounters.ts вызывают общий helper effects.ruleConditionsOk напрямую; семантика проверки условий не меняется.
откат: вернуть вызовы через GameEngine.ruleConditionsOk и восстановить его private-делегатор, если модульные границы будут пересмотрены.