package ca.kindredlink.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "clerk.enabled=true",
        "clerk.issuer=https://kindred-test.clerk.accounts.dev",
        "clerk.jwks-uri=https://kindred-test.clerk.accounts.dev/.well-known/jwks.json"
})
class ClerkSecurityConfigTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void protectedWritesRequireAClerkSession() throws Exception {
        mvc.perform(post("/api/nodes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mapAndAnonymousDeviceReadsRemainPublic() throws Exception {
        mvc.perform(get("/api/nodes"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/nodes")
                        .param("mine", "true")
                        .header("X-Device-Id", "dev-test"))
                .andExpect(status().isOk());
    }
}
