package com.ganoderma.platform.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DashboardStatsDto {
    private long isolatesCount;
    private long genesCount;
    private long samplesCount;
}
