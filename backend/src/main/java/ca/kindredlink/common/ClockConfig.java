package ca.kindredlink.common;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    /** Injected everywhere "now" matters, so tests can pin time and fast-forward 12 h windows. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
