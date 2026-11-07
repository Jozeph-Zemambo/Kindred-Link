package ca.kindredlink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ca.kindredlink.business.BusinessRepository;
import ca.kindredlink.node.NodeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@Autowired
	private DemoData demoData;

	@Autowired
	private NodeRepository nodes;

	@Autowired
	private BusinessRepository businesses;

	@Test
	void contextLoads() {
	}

	@Test
	void demoSeedIsIdempotentAcrossRuns() {
		long nodeCount = nodes.count();
		long businessCount = businesses.count();
		assertTrue(nodeCount > 0, "expected demo nodes to be seeded at startup");
		assertTrue(businessCount > 0, "expected demo businesses to be seeded at startup");

		demoData.run(new DefaultApplicationArguments(new String[0]));
		demoData.run(new DefaultApplicationArguments(new String[0]));

		assertEquals(nodeCount, nodes.count());
		assertEquals(businessCount, businesses.count());
	}

}
