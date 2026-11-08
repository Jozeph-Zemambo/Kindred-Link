package ca.kindredlink.security;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthSecurityTest {
    @Autowired
    MockMvc mvc;

    @Test
    void publicMapWorksWithoutLogin() throws Exception {
        mvc.perform(get("/api/nodes")).andExpect(status().isOk());
    }

    @Test
    void deviceIdCannotImpersonateAuth0User() throws Exception {
        mvc.perform(get("/api/me").header("X-Device-Id", "auth0-faked"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/nodes?mine=true").header("X-Device-Id", "auth0-faked"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/nodes")
                .header("X-Device-Id", "auth0-faked")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void signedInUserIsDerivedFromJwtSubject() throws Exception {
        mvc.perform(get("/api/me").with(jwt().jwt(token -> token.subject("google-oauth2|12345"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId", startsWith("auth0-")));
    }
}
