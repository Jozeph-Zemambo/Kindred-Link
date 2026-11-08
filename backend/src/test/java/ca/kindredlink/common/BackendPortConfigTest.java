package ca.kindredlink.common;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

/**
 * Verifies server.port honors a host-provided PORT variable (e.g. Render)
 * while still defaulting to 8080. Plain unit test - no context, no DB.
 */
class BackendPortConfigTest {

    /** Loads the real application.yml into a bare environment. */
    private MockEnvironment environmentFromApplicationYml() throws IOException {
        MockEnvironment environment = new MockEnvironment();
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("application.yml", new ClassPathResource("application.yml"));
        sources.forEach(environment.getPropertySources()::addLast);
        return environment;
    }

    @Test
    void defaultsTo8080WhenPortIsUnset() throws IOException {
        assertEquals("8080", environmentFromApplicationYml().getProperty("server.port"));
    }

    @Test
    void followsPortVariableWhenSet() throws IOException {
        MockEnvironment environment = environmentFromApplicationYml();
        environment.setProperty("PORT", "10000");
        assertEquals("10000", environment.getProperty("server.port"));
    }
}
